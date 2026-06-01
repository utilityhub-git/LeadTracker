import * as XLSX from "xlsx";
import type { ImportResult, SheetReport } from "@/app/dashboard/_components/types";
import {
  DNC_SHEET_NAME,
  NON_SALES_SHEETS,
  detectColumns,
  findBestPhoneColumn,
  findHeaderRow,
  sheetToRowMatrices,
  type ColMap,
  type RowPair,
} from "./excelParse";

/** Rows per API request — keeps each serverless invocation short */
export const IMPORT_CHUNK_SIZE = 250;

export type ImportProgress = {
  sheet: string;
  chunk: number;
  totalChunks: number;
  sheetsDone: number;
  totalSheets: number;
};

function chunkRows<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function detectedColumnLabels(headers: string[], cols: ColMap) {
  return {
    phone: cols.phone !== null ? (headers[cols.phone] ?? null) : null,
    nmi: cols.nmi !== null ? (headers[cols.nmi] ?? null) : null,
    date: cols.date !== null ? (headers[cols.date] ?? null) : null,
    center: cols.center !== null ? (headers[cols.center] ?? null) : null,
    campaign: cols.campaign !== null ? (headers[cols.campaign] ?? null) : null,
  };
}

export async function importExcelFileChunked(
  file: File,
  onProgress?: (p: ImportProgress) => void,
): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });

  const sheetNames = wb.SheetNames.filter((n) => !NON_SALES_SHEETS.has(n));
  const reports: SheetReport[] = [];

  let sheetIndex = 0;
  for (const sheetName of sheetNames) {
    sheetIndex++;
    const ws = wb.Sheets[sheetName];
    const { rowsRaw, rowsFmt } = sheetToRowMatrices(ws);

    if (rowsRaw.length < 2) continue;

    const headerIdx = findHeaderRow(rowsRaw);
    const headers = (rowsRaw[headerIdx] as unknown[]).map((v) =>
      typeof v === "string" ? v.trim() : String(v ?? ""),
    );
    const dataRaw = rowsRaw.slice(headerIdx + 1);
    const dataFmt = rowsFmt.slice(headerIdx + 1);

    const kind = sheetName === DNC_SHEET_NAME ? "dnc" : "sales";
    let cols = detectColumns(headers, dataRaw.slice(0, 20));
    if (kind === "dnc" && cols.phone === null) {
      cols = { ...cols, phone: findBestPhoneColumn(dataRaw) };
    }

    if (cols.phone === null) {
      reports.push({
        sheet: sheetName,
        skipped: true,
        reason: "no phone column detected",
      });
      continue;
    }

    const rowPairs: RowPair[] = dataRaw.map((raw, i) => ({
      raw: raw as unknown[],
      fmt: (dataFmt[i] ?? []) as unknown[],
    }));
    const chunks = chunkRows(rowPairs, IMPORT_CHUNK_SIZE);

    let inserted = 0;
    let duplicates = 0;
    let skippedRows = 0;

    for (let c = 0; c < chunks.length; c++) {
      onProgress?.({
        sheet: sheetName,
        chunk: c + 1,
        totalChunks: chunks.length || 1,
        sheetsDone: sheetIndex - 1,
        totalSheets: sheetNames.length,
      });

      const res = await fetch("/api/sales/import/chunk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sheet: sheetName,
          kind,
          columns: cols,
          rows: chunks[c],
        }),
      });

      const data = (await res.json()) as ChunkWriteResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Import failed on ${sheetName}`);
      }
      inserted += data.inserted;
      duplicates += data.duplicates;
      skippedRows += data.skippedRows;
    }

    reports.push({
      sheet: sheetName,
      inserted,
      duplicates,
      skippedRows,
      detectedColumns: detectedColumnLabels(headers, cols),
    });
  }

  return {
    summary: {
      totalInserted: reports.reduce((s, r) => s + (r.inserted ?? 0), 0),
      totalDuplicates: reports.reduce((s, r) => s + (r.duplicates ?? 0), 0),
      totalSkipped: reports.reduce((s, r) => s + (r.skippedRows ?? 0), 0),
    },
    sheets: reports,
  };
}

type ChunkWriteResult = {
  inserted: number;
  duplicates: number;
  skippedRows: number;
};
