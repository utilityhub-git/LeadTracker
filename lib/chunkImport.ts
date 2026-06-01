import { connectDb } from "./db";
import {
  type ColMap,
  normalizeNmi,
  normalizePhone,
  parseDate,
} from "./excelParse";
import { Dnc } from "@/models/Dnc";
import { Sale } from "@/models/Sale";

export type ImportChunkRow = { raw: unknown[]; fmt: unknown[] };

export type ImportChunkPayload = {
  sheet: string;
  kind: "sales" | "dnc";
  columns: ColMap;
  rows: ImportChunkRow[];
};

export type ChunkWriteResult = {
  inserted: number;
  duplicates: number;
  skippedRows: number;
};

export async function writeImportChunk(
  payload: ImportChunkPayload,
): Promise<ChunkWriteResult> {
  await connectDb();

  const { sheet, kind, columns, rows } = payload;
  const phoneCol = columns.phone;
  if (phoneCol === null) {
    return { inserted: 0, duplicates: 0, skippedRows: rows.length };
  }

  const ops: object[] = [];
  let skippedRows = 0;

  for (const { raw, fmt } of rows) {
    const phone = normalizePhone(raw[phoneCol]);
    if (!phone) {
      skippedRows++;
      continue;
    }

    if (kind === "dnc") {
      ops.push({
        updateOne: {
          filter: { phone },
          update: { $setOnInsert: { phone, imported_at: new Date() } },
          upsert: true,
        },
      });
    } else {
      const nmi =
        columns.nmi !== null ? normalizeNmi(raw[columns.nmi]) : null;
      const saleDate =
        parseDate(raw[columns.date ?? -1]) ??
        parseDate(fmt[columns.date ?? -1]) ??
        null;
      const rawCenter = columns.center !== null ? raw[columns.center] : null;
      const centerName =
        typeof rawCenter === "string" ? rawCenter.trim() || null : null;
      const rawCampaign = columns.campaign !== null ? raw[columns.campaign] : null;
      const campaignName =
        typeof rawCampaign === "string" ? rawCampaign.trim() || null : null;

      ops.push({
        updateOne: {
          filter: { phone, channel: sheet, sale_date: saleDate },
          update: {
            $setOnInsert: {
              phone,
              nmi,
              channel: sheet,
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
  }

  if (ops.length === 0) {
    return { inserted: 0, duplicates: 0, skippedRows };
  }

  if (kind === "dnc") {
    const result = await Dnc.bulkWrite(
      ops as Parameters<typeof Dnc.bulkWrite>[0],
      { ordered: false },
    );
    return {
      inserted: result.upsertedCount,
      duplicates: result.matchedCount,
      skippedRows,
    };
  }

  const result = await Sale.bulkWrite(
    ops as Parameters<typeof Sale.bulkWrite>[0],
    { ordered: false },
  );
  return {
    inserted: result.upsertedCount,
    duplicates: result.matchedCount,
    skippedRows,
  };
}
