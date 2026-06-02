import * as XLSX from "xlsx";

export const DNC_SHEET_NAME = "DNC List";
export const NON_SALES_SHEETS = new Set(["Sheet1"]);

const MIN_PHONE_SCORE = 5;
const MIN_DATE_SCORE = 5;
const MIN_CENTER_SCORE = 8;
const MIN_NMI_SCORE = 6;

const PHONE_KEYWORDS = ["mobile", "phone", "contact", " no", "number", "ph ", "mob"];
const DATE_KEYWORDS = [
  "date",
  "agreement",
  "doa",
  "sold",
  "sign",
  "closed",
  "connection",
  "install",
];
const CENTER_KEYWORDS = ["center", "centre", "branch", "hub", "location"];
const CAMPAIGN_KEYWORDS = ["campaign", "camp name", "camp_name", "promo", "promotion"];
const NMI_KEYWORDS = ["nmi", "mirn", "site_identifier", "site identifier", "electricity"];

const PHONE_RE = /^\d{9,10}$/;

export function normalizePhone(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).replace(/[\s\-\(\)\+]/g, "");
  if (!PHONE_RE.test(s)) return null;
  return s.length === 10 ? s : "0" + s;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function parseDate(val: unknown): Date | null {
  if (val instanceof Date && !Number.isNaN(val.getTime())) return val;

  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
    return null;
  }

  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return null;

    // ISO datetime string from JSON-serialised Date: "2026-04-30T00:00:00.000Z"
    const isoTs = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]/);
    if (isoTs) {
      const d = new Date(+isoTs[1], +isoTs[2] - 1, +isoTs[3]);
      if (!Number.isNaN(d.getTime())) return d;
    }

    // ISO date-only: "2026-04-30"
    const isoDate = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDate) {
      const d = new Date(+isoDate[1], +isoDate[2] - 1, +isoDate[3]);
      if (!Number.isNaN(d.getTime())) return d;
    }

    // Normalise double separators: "16//022024" → "16/022024"
    const cleaned = s.replace(/([\/\-\.]) *\1+/g, "$1");

    // d/m/yyyy or dd/mm/yyyy (/, -, .) — also handles US MM/DD/YYYY when day > 12
    const numFull = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (numFull) {
      let day = +numFull[1], month = +numFull[2];
      const year = +numFull[3];
      if (month > 12 && day <= 12) [day, month] = [month, day]; // US format swap
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const d = new Date(year, month - 1, day);
        if (!Number.isNaN(d.getTime()) && d.getMonth() === month - 1) return d;
      }
      // Last-resort swap (e.g. ambiguous single-digit both ≤ 12 but month part invalid)
      const d2 = new Date(+numFull[3], day - 1, month);
      if (!Number.isNaN(d2.getTime()) && d2.getMonth() === day - 1) return d2;
    }

    // "16/022024" — missing separator between month and year
    const numMissingSep = cleaned.match(/^(\d{1,2})[\/\-\.](\d{2})(\d{4})$/);
    if (numMissingSep) {
      const day = +numMissingSep[1], month = +numMissingSep[2], year = +numMissingSep[3];
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const d = new Date(year, month - 1, day);
        if (!Number.isNaN(d.getTime()) && d.getMonth() === month - 1) return d;
      }
    }

    // "30 Apr 2026", "30-Apr-2026", "30/Apr/2026", "30 April 2026", "30-Apr-26"
    const textMonth = cleaned.match(/^(\d{1,2})[\s\-\/]([A-Za-z]{3,9})[\s\-\/](\d{2,4})$/);
    if (textMonth) {
      const m = MONTH_NAMES[textMonth[2].toLowerCase().slice(0, 3)];
      if (m !== undefined) {
        let year = +textMonth[3];
        if (year < 100) year += year < 50 ? 2000 : 1900;
        const d = new Date(year, m, +textMonth[1]);
        if (!Number.isNaN(d.getTime())) return d;
      }
    }

    // "Apr 30, 2026", "April 30 2026"
    const textMonthFirst = cleaned.match(/^([A-Za-z]{3,9})[\s\-\/](\d{1,2}),?\s*(\d{2,4})$/);
    if (textMonthFirst) {
      const m = MONTH_NAMES[textMonthFirst[1].toLowerCase().slice(0, 3)];
      if (m !== undefined) {
        let year = +textMonthFirst[3];
        if (year < 100) year += year < 50 ? 2000 : 1900;
        const d = new Date(year, m, +textMonthFirst[2]);
        if (!Number.isNaN(d.getTime())) return d;
      }
    }
  }

  return null;
}

/** Convert Excel cells to JSON-safe values (Date → dd-mm-yyyy string). */
export function serializeImportCell(val: unknown): unknown {
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    const d = val.getDate();
    const m = val.getMonth() + 1;
    const y = val.getFullYear();
    return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
  }
  return val;
}

export function serializeImportRow(
  row: unknown[],
  dateCol: number | null,
): unknown[] {
  return row.map((cell, i) =>
    dateCol === i ? serializeImportCell(cell) : cell,
  );
}

function dateValueLabel(val: unknown): string {
  if (val == null) return "(empty)";
  if (val instanceof Date) return val.toISOString();
  return String(val).trim().slice(0, 40) || "(blank)";
}

/** Parse sale date from a row (values should already be serializeImportRow'd). */
export function resolveSaleDate(
  raw: unknown[],
  dateCol: number | null,
  dateFmt?: unknown,
): Date | null {
  if (dateCol === null) return null;
  for (const candidate of [raw[dateCol], dateFmt]) {
    const parsed = parseDate(candidate);
    if (parsed) return parsed;
  }
  return null;
}

export type DateAudit = {
  column: string | null;
  columnIndex: number | null;
  rowsChecked: number;
  parsed: number;
  missing: number;
  sampleFailures: string[];
};

/** Check how many rows parse a sale date before / after import (client-side). */
export function auditDateColumn(
  headers: string[],
  cols: ColMap,
  rows: { raw: unknown[] }[],
  maxCheck = 800,
): DateAudit {
  const columnIndex = cols.date;
  const column =
    columnIndex !== null ? (headers[columnIndex] ?? null) : null;
  if (columnIndex === null) {
    return {
      column: null,
      columnIndex: null,
      rowsChecked: 0,
      parsed: 0,
      missing: 0,
      sampleFailures: ["No date column detected — check header row has DOA / Date"],
    };
  }

  let parsed = 0;
  let missing = 0;
  const sampleFailures: string[] = [];
  const toCheck = rows.slice(0, maxCheck);

  for (const row of toCheck) {
    const rawVal = row.raw[columnIndex];
    if (rawVal == null) continue;

    if (resolveSaleDate(row.raw, columnIndex)) {
      parsed++;
    } else {
      missing++;
      if (sampleFailures.length < 5) {
        sampleFailures.push(`value=${dateValueLabel(rawVal)}`);
      }
    }
  }

  return {
    column,
    columnIndex,
    rowsChecked: toCheck.length,
    parsed,
    missing,
    sampleFailures,
  };
}

/** Spread sample across the sheet — top rows are often blank before real data. */
export function sampleRowsForDetection(
  rows: unknown[][],
  max = 40,
): unknown[][] {
  if (rows.length <= max) return rows;
  const indices = new Set<number>();
  for (let i = 0; i < max; i++) {
    indices.add(Math.floor((i * (rows.length - 1)) / (max - 1)));
  }
  return [...indices].sort((a, b) => a - b).map((i) => rows[i]);
}

/** Pad sparse xlsx rows so column indexes line up with the header row. */
export function padRow(row: unknown[], columnCount: number): unknown[] {
  const out = new Array<unknown>(columnCount).fill(null);
  for (let i = 0; i < row.length && i < columnCount; i++) {
    out[i] = row[i];
  }
  return out;
}

export function normalizeNmi(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (s.length < 6 || looksLikeDate(s)) return null;
  return s;
}

function looksLikePhone(val: unknown): boolean {
  return normalizePhone(val) !== null;
}
function looksLikeDate(val: unknown): boolean {
  return parseDate(val) !== null;
}
function looksLikeNmi(val: unknown): boolean {
  if (val == null) return false;
  const s = String(val).trim();

  if (s.length < 6 || s.length > 15) return false;
  if (looksLikeDate(val)) return false;

  if (/^\d+$/.test(s)) {
    if (s.length === 9) return false;
    if (s.length === 10 && s.startsWith("0")) return false;
    return true;
  }

  if (!/^[A-Z0-9]+$/i.test(s)) return false;
  if (!/[A-Z]/i.test(s)) return false;
  if (!/\d/.test(s)) return false;
  return true;
}

export function findHeaderRow(rows: unknown[][]): number {
  let bestRow = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const score = rows[i].filter(
      (v) => typeof v === "string" && v.trim().length > 1,
    ).length;
    if (score > bestScore) {
      bestScore = score;
      bestRow = i;
    }
  }
  return bestRow;
}

export type ColMap = {
  phone: number | null;
  nmi: number | null;
  date: number | null;
  center: number | null;
  campaign: number | null;
};

export function detectColumns(headers: string[], sampleRows: unknown[][]): ColMap {
  const sample = sampleRowsForDetection(sampleRows, 40);
  let phoneBest = { idx: null as number | null, score: 0 };
  let nmisBest = { idx: null as number | null, score: 0 };
  let dateBest = { idx: null as number | null, score: 0 };
  let centerBest = { idx: null as number | null, score: 0 };
  let campaignBest = { idx: null as number | null, score: 0 };

  for (let idx = 0; idx < headers.length; idx++) {
    const h = (headers[idx] || "").toLowerCase().trim();
    const vals = sample.map((r) => r[idx]).filter((v) => v != null).slice(0, 15);

    const ph =
      PHONE_KEYWORDS.filter((kw) => h.includes(kw)).length * 3 +
      vals.filter(looksLikePhone).length;
    const nm =
      NMI_KEYWORDS.filter((kw) => h.includes(kw)).length * 5 +
      vals.filter(looksLikeNmi).length;
    const dt =
      DATE_KEYWORDS.filter((kw) => h.includes(kw)).length * 3 +
      vals.filter(looksLikeDate).length;
    const ct =
      CENTER_KEYWORDS.filter((kw) => h.includes(kw)).length * 4 +
      vals.filter(
        (v) =>
          typeof v === "string" &&
          v.length > 2 &&
          v.length < 80 &&
          !looksLikeDate(v) &&
          !looksLikePhone(v) &&
          !looksLikeNmi(v),
      ).length;

    const cp =
      CAMPAIGN_KEYWORDS.filter((kw) => h.includes(kw)).length * 4 +
      vals.filter(
        (v) =>
          typeof v === "string" &&
          v.length > 2 &&
          v.length < 120 &&
          !looksLikeDate(v) &&
          !looksLikePhone(v) &&
          !looksLikeNmi(v),
      ).length;

    if (ph > phoneBest.score) phoneBest = { idx, score: ph };
    if (nm > nmisBest.score) nmisBest = { idx, score: nm };
    if (dt > dateBest.score) dateBest = { idx, score: dt };
    if (ct > centerBest.score) centerBest = { idx, score: ct };
    if (cp > campaignBest.score) campaignBest = { idx, score: cp };
  }

  const MIN_CAMPAIGN_SCORE = 4;
  let dateIdx =
    dateBest.score >= MIN_DATE_SCORE ? dateBest.idx : null;
  if (dateIdx === null) {
    dateIdx = findBestDateColumn(sampleRowsForDetection(sampleRows, 120));
  }

  const raw: ColMap = {
    phone: phoneBest.score >= MIN_PHONE_SCORE ? phoneBest.idx : null,
    nmi: nmisBest.score >= MIN_NMI_SCORE ? nmisBest.idx : null,
    date: dateIdx,
    center: centerBest.score >= MIN_CENTER_SCORE ? centerBest.idx : null,
    campaign: campaignBest.score >= MIN_CAMPAIGN_SCORE ? campaignBest.idx : null,
  };

  // Resolve conflicts: if two fields share the same column index, keep only the higher-scoring one
  const scores: Record<keyof ColMap, number> = {
    phone: phoneBest.score,
    nmi: nmisBest.score,
    date: dateBest.score,
    center: centerBest.score,
    campaign: campaignBest.score,
  };
  const seen = new Map<number, { key: keyof ColMap; score: number }>();
  for (const key of Object.keys(raw) as Array<keyof ColMap>) {
    const idx = raw[key];
    if (idx === null) continue;
    const existing = seen.get(idx);
    if (existing) {
      if (scores[key] > existing.score) {
        raw[existing.key] = null;
        seen.set(idx, { key, score: scores[key] });
      } else {
        raw[key] = null;
      }
    } else {
      seen.set(idx, { key, score: scores[key] });
    }
  }
  return raw;
}

export function findBestPhoneColumn(rows: unknown[][]): number | null {
  const colCount = Math.max(0, ...rows.map((r) => r.length));
  let bestIdx: number | null = null;
  let bestScore = 0;
  for (let idx = 0; idx < colCount; idx++) {
    const score = rows
      .slice(0, 30)
      .map((r) => r[idx])
      .filter(looksLikePhone).length;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }
  return bestScore >= 3 ? bestIdx : null;
}

export function findBestDateColumn(rows: unknown[][]): number | null {
  const colCount = Math.max(0, ...rows.map((r) => r.length));
  let bestIdx: number | null = null;
  let bestScore = 0;
  for (let idx = 0; idx < colCount; idx++) {
    const score = sampleRowsForDetection(rows, 80)
      .map((r) => r[idx])
      .filter(looksLikeDate).length;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }
  return bestScore >= 3 ? bestIdx : null;
}

export type RowPair = { raw: unknown[]; fmt: unknown[] };

export function sheetToRowMatrices(ws: XLSX.WorkSheet): {
  rowsRaw: unknown[][];
  rowsFmt: unknown[][];
} {
  // Parse once only. With cellDates:true at workbook level, date cells arrive as
  // JS Date objects → JSON-serialised to ISO strings → parseDate handles them.
  // Passing the same array for rowsFmt avoids a second full-sheet scan.
  const rowsRaw = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];
  return { rowsRaw, rowsFmt: rowsRaw };
}
