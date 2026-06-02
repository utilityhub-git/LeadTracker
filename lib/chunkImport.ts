import type { Model } from "mongoose";
import { connectDb } from "./db";
import {
  type ColMap,
  normalizeNmi,
  normalizePhone,
  padRow,
} from "./excelParse";
import { serializeImportWrite } from "./importWriteLock";
import { Dnc } from "@/models/Dnc";
import { Sale } from "@/models/Sale";

type BulkCounts = { inserted: number; duplicates: number };

function countsFromResult(result: {
  upsertedCount: number;
  matchedCount: number;
}): BulkCounts {
  return {
    inserted: result.upsertedCount,
    duplicates: result.matchedCount,
  };
}

function bulkPartialResult(err: unknown) {
  if (typeof err !== "object" || err === null || !("result" in err)) {
    return undefined;
  }
  return (err as { result?: { upsertedCount: number; matchedCount: number } })
    .result;
}

function isRetriableBulkError(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code: number }).code
      : 0;
  return code === 175 || code === 11600 || code === 11602;
}

async function safeBulkWrite(
  model: Model<{ phone: string }>,
  ops: object[],
): Promise<BulkCounts> {
  const run = () =>
    model.bulkWrite(ops as Parameters<typeof Sale.bulkWrite>[0], {
      ordered: false,
    });

  try {
    return countsFromResult(await run());
  } catch (err: unknown) {
    const partialResult = bulkPartialResult(err);

    if (isRetriableBulkError(err)) {
      await new Promise((r) => setTimeout(r, 600));
      try {
        return countsFromResult(await run());
      } catch (retryErr: unknown) {
        const retryPartial = bulkPartialResult(retryErr);
        if (retryPartial) return countsFromResult(retryPartial);
        throw retryErr;
      }
    }

    if (partialResult) return countsFromResult(partialResult);
    throw err;
  }
}

const BULK_WRITE_BATCH = 120;

async function safeBulkWriteBatched(
  model: Model<{ phone: string }>,
  ops: object[],
): Promise<BulkCounts> {
  let inserted = 0;
  let duplicates = 0;
  for (let i = 0; i < ops.length; i += BULK_WRITE_BATCH) {
    const batch = ops.slice(i, i + BULK_WRITE_BATCH);
    const counts = await safeBulkWrite(model, batch);
    inserted += counts.inserted;
    duplicates += counts.duplicates;
  }
  return { inserted, duplicates };
}

export type ImportChunkRow = {
  raw: unknown[];
};

export type ImportChunkPayload = {
  sheet: string;
  kind: "sales" | "dnc";
  columns: ColMap;
  columnCount: number;
  rows: ImportChunkRow[];
};

export type ChunkWriteResult = {
  inserted: number;
  duplicates: number;
  skippedRows: number;
  /** Rows in this chunk where a date cell existed but could not be parsed */
  datesMissing?: number;
  /** Rows in this chunk with a parsed sale_date */
  datesParsed?: number;
};

export async function writeImportChunk(
  payload: ImportChunkPayload,
): Promise<ChunkWriteResult> {
  await connectDb();

  const { sheet, kind, columns, columnCount, rows } = payload;
  const phoneCol = columns.phone;
  if (phoneCol === null) {
    return { inserted: 0, duplicates: 0, skippedRows: rows.length };
  }

  const ops: object[] = [];
  let skippedRows = 0;
  let datesParsed = 0;
  let datesMissing = 0;

  for (const row of rows) {
    const raw = padRow(row.raw, columnCount);
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
      const rawDateVal = columns.date !== null ? raw[columns.date] : null;
      const saleDate =
        typeof rawDateVal === "string" && rawDateVal.trim()
          ? rawDateVal.trim()
          : null;
      if (columns.date !== null) {
        if (saleDate) datesParsed++;
        else if (rawDateVal != null) datesMissing++;
      }
      const rawCenter = columns.center !== null ? raw[columns.center] : null;
      const centerName =
        typeof rawCenter === "string" ? rawCenter.trim() || null : null;
      const rawCampaign = columns.campaign !== null ? raw[columns.campaign] : null;
      const campaignName =
        typeof rawCampaign === "string" ? rawCampaign.trim() || null : null;

      if (saleDate) {
        ops.push({
          updateOne: {
            filter: { phone, channel: sheet, sale_date: null },
            update: { $set: { sale_date: saleDate } },
          },
        });
      }

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
    return {
      inserted: 0,
      duplicates: 0,
      skippedRows,
      datesParsed,
      datesMissing,
    };
  }

  return serializeImportWrite(async () => {
    const model = kind === "dnc" ? Dnc : Sale;
    const { inserted, duplicates } = await safeBulkWriteBatched(model, ops);
    return {
      inserted,
      duplicates,
      skippedRows,
      datesParsed,
      datesMissing,
    };
  });
}
