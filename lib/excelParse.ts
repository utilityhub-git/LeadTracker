import * as XLSX from "xlsx";

export const DNC_SHEET_NAME = "DNC List";
export const NON_SALES_SHEETS = new Set(["Sheet1"]);

const MIN_PHONE_SCORE = 5;
const MIN_DATE_SCORE = 5;
const MIN_CENTER_SCORE = 8;
const MIN_NMI_SCORE = 6;

const PHONE_KEYWORDS = ["mobile", "phone", "contact", " no", "number", "ph ", "mob"];
const DATE_KEYWORDS = ["date", "agreement", "doa", "sold"];
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

export function parseDate(val: unknown): Date | null {
  if (val instanceof Date && !Number.isNaN(val.getTime())) return val;
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof val === "string") {
    const patterns: [RegExp, (a: string, b: string, c: string) => Date][] = [
      [/^(\d{2})\/(\d{2})\/(\d{4})$/, (d, m, y) => new Date(+y, +m - 1, +d)],
      [/^(\d{2})-(\d{2})-(\d{4})$/, (d, m, y) => new Date(+y, +m - 1, +d)],
      [/^(\d{2})\.(\d{2})\.(\d{4})$/, (d, m, y) => new Date(+y, +m - 1, +d)],
      [/^(\d{4})-(\d{2})-(\d{2})$/, (y, m, d) => new Date(+y, +m - 1, +d)],
    ];
    for (const [re, build] of patterns) {
      const m = val.trim().match(re);
      if (m) {
        const date = build(m[1], m[2], m[3]);
        if (!Number.isNaN(date.getTime())) return date;
      }
    }
  }
  return null;
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
  let phoneBest = { idx: null as number | null, score: 0 };
  let nmisBest = { idx: null as number | null, score: 0 };
  let dateBest = { idx: null as number | null, score: 0 };
  let centerBest = { idx: null as number | null, score: 0 };
  let campaignBest = { idx: null as number | null, score: 0 };

  for (let idx = 0; idx < headers.length; idx++) {
    const h = (headers[idx] || "").toLowerCase().trim();
    const vals = sampleRows.map((r) => r[idx]).filter((v) => v != null).slice(0, 15);

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

  return {
    phone: phoneBest.score >= MIN_PHONE_SCORE ? phoneBest.idx : null,
    nmi: nmisBest.score >= MIN_NMI_SCORE ? nmisBest.idx : null,
    date: dateBest.score >= MIN_DATE_SCORE ? dateBest.idx : null,
    center: centerBest.score >= MIN_CENTER_SCORE ? centerBest.idx : null,
    campaign: campaignBest.score >= 4 ? campaignBest.idx : null,
  };
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

export type RowPair = { raw: unknown[]; fmt: unknown[] };

export function sheetToRowMatrices(ws: XLSX.WorkSheet): {
  rowsRaw: unknown[][];
  rowsFmt: unknown[][];
} {
  return {
    rowsRaw: XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true }),
    rowsFmt: XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }),
  };
}
