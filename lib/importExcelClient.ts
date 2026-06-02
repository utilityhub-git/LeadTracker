import * as XLSX from "xlsx";
import type { ImportResult, SheetReport } from "@/app/dashboard/_components/types";
import {
  DNC_SHEET_NAME,
  NON_SALES_SHEETS,
  detectColumns,
  findBestPhoneColumn,
  findHeaderRow,
  padRow,
  auditDateColumn,
  sampleRowsForDetection,
  serializeImportRow,
  type ColMap,
} from "./excelParse";

/** Rows per API request — kept small so each request finishes within Vercel's function timeout */
export const IMPORT_CHUNK_SIZE = 600;

const CHUNK_MAX_RETRIES = 3;

/** Max concurrent chunk requests per sheet */
const CHUNK_CONCURRENCY = 3;

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postImportChunk(
  payload: object,
  sheetName: string,
): Promise<ChunkWriteResult> {
  let lastError = "Chunk import failed";

  for (let attempt = 0; attempt < CHUNK_MAX_RETRIES; attempt++) {
    try {
      const res = await fetch("/api/sales/import/chunk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as ChunkWriteResult & { error?: string };
      if (res.ok) return data;

      lastError = data.error ?? `Import failed on ${sheetName} (${res.status})`;
      if (res.status < 500 || attempt === CHUNK_MAX_RETRIES - 1) {
        throw new Error(lastError);
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : lastError;
      if (attempt === CHUNK_MAX_RETRIES - 1) throw err;
    }

    await sleep(400 * (attempt + 1));
  }

  throw new Error(lastError);
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
  const wb = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    cellNF: false,
    cellStyles: false,
  });

  const sheetNames = wb.SheetNames.filter((n) => !NON_SALES_SHEETS.has(n));
  const reports: SheetReport[] = [];

  let sheetIndex = 0;
  for (const sheetName of sheetNames) {
    sheetIndex++;
    const ws = wb.Sheets[sheetName];
    const rowsRaw = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
      raw: true,
    }) as unknown[][];

    if (rowsRaw.length < 2) continue;

    const headerIdx = findHeaderRow(rowsRaw);
    const headers = (rowsRaw[headerIdx] as unknown[]).map((v) =>
      typeof v === "string" ? v.trim() : String(v ?? ""),
    );
    const columnCount = headers.length;
    const dataRaw = rowsRaw.slice(headerIdx + 1);

    const kind = sheetName === DNC_SHEET_NAME ? "dnc" : "sales";
    let cols = detectColumns(
      headers,
      sampleRowsForDetection(dataRaw as unknown[][], 200),
    );
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

    const paddedRows = (dataRaw as unknown[][]).map((raw) => ({
      raw: serializeImportRow(padRow(raw, columnCount), cols.date),
    }));
    const dateAudit =
      kind === "sales"
        ? auditDateColumn(headers, cols, paddedRows)
        : undefined;

    const chunks = chunkRows(paddedRows, IMPORT_CHUNK_SIZE);
    let chunksDone = 0;
    let failedChunks = 0;

    let inserted = 0;
    let duplicates = 0;
    let skippedRows = 0;
    let importDatesParsed = 0;
    let importDatesMissing = 0;

    const basePayload = { sheet: sheetName, kind, columns: cols, columnCount };

    for (let i = 0; i < chunks.length; i += CHUNK_CONCURRENCY) {
      const batch = chunks.slice(i, i + CHUNK_CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((rows) => postImportChunk({ ...basePayload, rows }, sheetName)),
      );

      for (const result of settled) {
        if (result.status === "fulfilled") {
          inserted += result.value.inserted;
          duplicates += result.value.duplicates;
          skippedRows += result.value.skippedRows;
          importDatesParsed += result.value.datesParsed ?? 0;
          importDatesMissing += result.value.datesMissing ?? 0;
        } else {
          // Chunk failed after all retries — record it and continue with remaining chunks
          failedChunks++;
        }
      }

      chunksDone += batch.length;
      onProgress?.({
        sheet: sheetName,
        chunk: chunksDone,
        totalChunks: chunks.length || 1,
        sheetsDone: sheetIndex - 1,
        totalSheets: sheetNames.length,
      });
    }

    reports.push({
      sheet: sheetName,
      inserted,
      duplicates,
      skippedRows,
      detectedColumns: detectedColumnLabels(headers, cols),
      dateAudit: dateAudit
        ? {
            column: dateAudit.column,
            rowsChecked: dateAudit.rowsChecked,
            parsed:
              importDatesParsed > 0
                ? importDatesParsed
                : dateAudit.parsed,
            missing:
              importDatesMissing > 0
                ? importDatesMissing
                : dateAudit.missing,
            sampleFailures: dateAudit.sampleFailures,
          }
        : undefined,
      failedChunks: failedChunks > 0 ? failedChunks : undefined,
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
  datesParsed?: number;
  datesMissing?: number;
};
