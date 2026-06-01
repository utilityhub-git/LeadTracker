import * as XLSX from "xlsx";
import { connectDb } from "./db";
import {
  DNC_SHEET_NAME,
  NON_SALES_SHEETS,
  detectColumns,
  findBestPhoneColumn,
  findHeaderRow,
  normalizeNmi,
  normalizePhone,
  parseDate,
  sheetToRowMatrices,
} from "./excelParse";
import { Dnc } from "@/models/Dnc";
import { Sale } from "@/models/Sale";

export { DNC_SHEET_NAME, normalizeNmi, normalizePhone } from "./excelParse";

export interface SheetReport {
  sheet: string;
  skipped?: boolean;
  reason?: string;
  inserted?: number;
  duplicates?: number;
  skippedRows?: number;
  detectedColumns?: {
    phone: string | null;
    nmi: string | null;
    date: string | null;
    center: string | null;
  };
}

async function importDncSheet(ws: XLSX.WorkSheet): Promise<SheetReport> {
  const { rowsRaw } = sheetToRowMatrices(ws);

  if (rowsRaw.length < 2) {
    return { sheet: DNC_SHEET_NAME, skipped: true, reason: "empty sheet" };
  }

  const headerIdx = findHeaderRow(rowsRaw);
  const headers = (rowsRaw[headerIdx] as unknown[]).map((v) =>
    typeof v === "string" ? v.trim() : String(v ?? ""),
  );
  const dataRaw = rowsRaw.slice(headerIdx + 1);
  const cols = detectColumns(headers, dataRaw.slice(0, 20));
  const phoneCol = cols.phone ?? findBestPhoneColumn(dataRaw);

  if (phoneCol === null) {
    return {
      sheet: DNC_SHEET_NAME,
      skipped: true,
      reason: "no phone column detected",
    };
  }

  const ops: object[] = [];
  let skippedRows = 0;

  for (const raw of dataRaw) {
    const phone = normalizePhone(raw[phoneCol]);
    if (!phone) {
      skippedRows++;
      continue;
    }
    ops.push({
      updateOne: {
        filter: { phone },
        update: { $setOnInsert: { phone, imported_at: new Date() } },
        upsert: true,
      },
    });
  }

  if (ops.length === 0) {
    return { sheet: DNC_SHEET_NAME, inserted: 0, duplicates: 0, skippedRows };
  }

  const result = await Dnc.bulkWrite(
    ops as Parameters<typeof Dnc.bulkWrite>[0],
    { ordered: false },
  );

  return {
    sheet: DNC_SHEET_NAME,
    inserted: result.upsertedCount,
    duplicates: result.matchedCount,
    skippedRows,
    detectedColumns: {
      phone: headers[phoneCol] ?? null,
      nmi: null,
      date: null,
      center: null,
    },
  };
}

/**
 * Legacy single-request import (may timeout on Vercel for large files).
 * Prefer client-side chunked import via /api/sales/import/chunk.
 */
export async function importExcelBuffer(buffer: ArrayBuffer): Promise<SheetReport[]> {
  await connectDb();

  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const report: SheetReport[] = [];

  for (const sheetName of wb.SheetNames) {
    if (NON_SALES_SHEETS.has(sheetName)) continue;

    const ws = wb.Sheets[sheetName];

    if (sheetName === DNC_SHEET_NAME) {
      report.push(await importDncSheet(ws));
      continue;
    }

    const { rowsRaw, rowsFmt } = sheetToRowMatrices(ws);

    if (rowsRaw.length < 2) continue;

    const headerIdx = findHeaderRow(rowsRaw);
    const headers = (rowsRaw[headerIdx] as unknown[]).map((v) =>
      typeof v === "string" ? v.trim() : String(v ?? ""),
    );
    const dataRaw = rowsRaw.slice(headerIdx + 1);
    const dataFmt = rowsFmt.slice(headerIdx + 1);
    const cols = detectColumns(headers, dataRaw.slice(0, 20));

    if (cols.phone === null) {
      report.push({
        sheet: sheetName,
        skipped: true,
        reason: "no phone column detected",
      });
      continue;
    }

    const ops: object[] = [];
    let skippedRows = 0;

    for (let i = 0; i < dataRaw.length; i++) {
      const raw = dataRaw[i];
      const fmt = dataFmt[i];

      const phone = normalizePhone(raw[cols.phone!]);
      if (!phone) {
        skippedRows++;
        continue;
      }

      const nmi = cols.nmi !== null ? normalizeNmi(raw[cols.nmi]) : null;
      const saleDate =
        parseDate(raw[cols.date ?? -1]) ?? parseDate(fmt[cols.date ?? -1]) ?? null;
      const rawCenter = cols.center !== null ? raw[cols.center] : null;
      const centerName =
        typeof rawCenter === "string" ? rawCenter.trim() || null : null;
      const rawCampaign = cols.campaign !== null ? raw[cols.campaign] : null;
      const campaignName =
        typeof rawCampaign === "string" ? rawCampaign.trim() || null : null;

      ops.push({
        updateOne: {
          filter: { phone, channel: sheetName, sale_date: saleDate },
          update: {
            $setOnInsert: {
              phone,
              nmi,
              channel: sheetName,
              sale_date: saleDate,
              center_name: centerName,
              campaign_name: campaignName,
              imported_at: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    if (ops.length > 0) {
      const result = await Sale.bulkWrite(
        ops as Parameters<typeof Sale.bulkWrite>[0],
        { ordered: false },
      );
      report.push({
        sheet: sheetName,
        inserted: result.upsertedCount,
        duplicates: result.matchedCount,
        skippedRows,
        detectedColumns: {
          phone: headers[cols.phone!] ?? null,
          nmi: cols.nmi !== null ? (headers[cols.nmi] ?? null) : null,
          date: cols.date !== null ? (headers[cols.date] ?? null) : null,
          center: cols.center !== null ? (headers[cols.center] ?? null) : null,
          campaign: cols.campaign !== null ? (headers[cols.campaign] ?? null) : null,
        },
      });
    } else {
      report.push({ sheet: sheetName, inserted: 0, duplicates: 0, skippedRows });
    }
  }

  return report;
}

export interface ChannelResult {
  channel: string;
  count: number;
  records: {
    phone: string;
    nmi: string | null;
    sale_date: Date | null;
    center_name: string | null;
    campaign_name: string | null;
  }[];
}

const RECORD_PUSH = {
  phone: "$phone",
  nmi: "$nmi",
  sale_date: "$sale_date",
  center_name: "$center_name",
  campaign_name: "$campaign_name",
};

export async function isPhoneInDnc(phone: string): Promise<boolean> {
  await connectDb();
  const normalized = normalizePhone(phone) ?? phone;
  const doc = await Dnc.findOne({ phone: normalized }).select("_id").lean();
  return !!doc;
}

export async function searchByPhone(phone: string): Promise<ChannelResult[]> {
  await connectDb();
  const normalized = normalizePhone(phone) ?? phone;
  return Sale.aggregate<ChannelResult>([
    { $match: { phone: normalized, channel: { $ne: DNC_SHEET_NAME } } },
    {
      $group: {
        _id: "$channel",
        count: { $sum: 1 },
        records: { $push: RECORD_PUSH },
      },
    },
    { $project: { _id: 0, channel: "$_id", count: 1, records: 1 } },
    { $sort: { channel: 1 } },
  ]);
}

export async function searchByNmi(nmi: string): Promise<ChannelResult[]> {
  await connectDb();
  const normalized = normalizeNmi(nmi) ?? nmi;
  return Sale.aggregate<ChannelResult>([
    { $match: { nmi: normalized } },
    {
      $group: {
        _id: "$channel",
        count: { $sum: 1 },
        records: { $push: RECORD_PUSH },
      },
    },
    { $project: { _id: 0, channel: "$_id", count: 1, records: 1 } },
    { $sort: { channel: 1 } },
  ]);
}
