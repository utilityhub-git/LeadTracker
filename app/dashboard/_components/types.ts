export type User = { id: string; email: string };

export type SearchRecord = {
  phone: string;
  nmi: string | null;
  sale_date: string | null;
  center_name: string | null;
  campaign_name: string | null;
};

export type SearchChannel = {
  channel: string;
  count: number;
  records: SearchRecord[];
};

export type SearchResult = {
  type: "phone" | "nmi";
  query: string;
  found: boolean;
  channels: SearchChannel[];
  /** Set when searching by phone and the number exists on the DNC List */
  inDnc?: boolean;
};

export type SheetReport = {
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
    campaign: string | null;
  };
  /** Pre-import check: can we parse dates from the detected column? */
  dateAudit?: {
    column: string | null;
    rowsChecked: number;
    parsed: number;
    missing: number;
    sampleFailures: string[];
  };
  failedChunks?: number;
};

export type ImportResult = {
  summary: {
    totalInserted: number;
    totalDuplicates: number;
    totalSkipped: number;
  };
  sheets: SheetReport[];
};
