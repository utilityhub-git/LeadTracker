"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  Upload,
  X,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import type { ImportResult } from "./types";
import { cls } from "./utils";
import {
  importExcelFileChunked,
  type ImportProgress,
} from "@/lib/importExcelClient";

type Props = Readonly<{
  onClose: () => void;
  onImported: () => void;
}>;

export function ImportModal({ onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    setProgress(null);
    try {
      const data = await importExcelFileChunked(file, (p) => setProgress(p));
      setResult(data);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close import modal"
      />

      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl shadow-slate-200 border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
              <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Import Sales Data
              </h2>
              <p className="text-xs text-slate-500">
                Large files import in batches to avoid timeouts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!result ? (
            <form onSubmit={handleImport} className="space-y-4">
              <label
                className={cls(
                  "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors",
                  file
                    ? "border-indigo-300 bg-indigo-50/50"
                    : "border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40",
                )}
              >
                <div
                  className={cls(
                    "flex h-12 w-12 items-center justify-center rounded-xl",
                    file ? "bg-indigo-100" : "bg-slate-100",
                  )}
                >
                  <Upload
                    className={cls(
                      "h-5 w-5",
                      file ? "text-indigo-600" : "text-slate-400",
                    )}
                  />
                </div>
                <div className="text-center">
                  {file ? (
                    <p className="text-sm font-medium text-indigo-700">
                      {file.name}
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-700">
                        Click to browse or drag &amp; drop
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        .xlsx or .xls files only
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setError(null);
                  }}
                />
              </label>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {loading && progress && (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-800">
                  <p className="font-medium">{progress.sheet}</p>
                  <p className="text-xs text-indigo-600 mt-0.5">
                    Batch {progress.chunk} of {progress.totalChunks} · sheet{" "}
                    {progress.sheetsDone + 1} of {progress.totalSheets}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !file}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                <Upload className="h-4 w-4" />
                {loading ? "Importing…" : "Import File"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                  <div className="text-xl font-bold text-emerald-700">
                    {result.summary.totalInserted}
                  </div>
                  <div className="text-xs text-emerald-600 mt-0.5">
                    New records
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                  <div className="text-xl font-bold text-slate-600">
                    {result.summary.totalDuplicates}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Duplicates
                  </div>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
                  <div className="text-xl font-bold text-amber-700">
                    {result.summary.totalSkipped}
                  </div>
                  <div className="text-xs text-amber-600 mt-0.5">
                    No phone
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {result.sheets.map((r) => (
                  <div
                    key={r.sheet}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    {r.skipped ? (
                      <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-slate-700 min-w-[100px]">
                      {r.sheet}
                    </span>
                    {r.skipped ? (
                      <span className="text-xs text-slate-400 italic">
                        {r.reason}
                      </span>
                    ) : (
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                          <span className="text-xs text-emerald-600">
                            {r.inserted} new
                          </span>
                          {(r.duplicates ?? 0) > 0 && (
                            <span className="text-xs text-slate-400">
                              {r.duplicates} dup
                            </span>
                          )}
                          {(r.skippedRows ?? 0) > 0 && (
                            <span className="text-xs text-slate-400">
                              {r.skippedRows} skipped
                            </span>
                          )}
                        </div>
                        {r.dateAudit && (
                          <p
                            className={cls(
                              "text-xs",
                              r.dateAudit.missing > 0
                                ? "text-amber-700"
                                : "text-slate-500",
                            )}
                          >
                            Date column: {r.dateAudit.column ?? "not found"} ·{" "}
                            {r.dateAudit.parsed} parsed
                            {r.dateAudit.missing > 0 &&
                              ` · ${r.dateAudit.missing} could not parse`}
                          </p>
                        )}
                        {r.dateAudit?.sampleFailures &&
                          r.dateAudit.sampleFailures.length > 0 &&
                          r.dateAudit.missing > 0 && (
                            <p className="text-xs text-amber-600/90 truncate">
                              e.g. {r.dateAudit.sampleFailures[0]}
                            </p>
                          )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 py-2.5 text-sm font-medium text-slate-700 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
