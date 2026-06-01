"use client";

import { useEffect, useState } from "react";
import { Ban, Phone, X, ChevronRight } from "lucide-react";
import type { SearchResult } from "./types";
import { cls, formatDate } from "./utils";

type Props = Readonly<{
  result: SearchResult;
  onClose: () => void;
}>;

function DncOnlyCard({ phone }: Readonly<{ phone: string }>) {
  return (
    <div className="rounded-xl border-2 border-red-300 bg-red-50 p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-3">
        <Ban className="h-6 w-6 text-red-600" />
      </div>
      <h3 className="text-base font-semibold text-red-800">DNC number</h3>
      <p className="mt-1 font-mono text-lg font-semibold text-red-700">{phone}</p>
      <p className="mt-2 text-sm text-red-600/90">
        This number is on the Do Not Call list. No sales records were found in
        other channels.
      </p>
    </div>
  );
}

export function SearchResults({ result, onClose }: Props) {
  const [closedChannels, setClosedChannels] = useState<Set<string>>(() => new Set());
  const inDnc = result.type === "phone" && !!result.inDnc;
  const showDncColumn = result.type === "phone" && inDnc;

  useEffect(() => {
    setClosedChannels(new Set());
  }, [result.query, result.type]);

  function toggleChannel(channel: string) {
    setClosedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) next.delete(channel);
      else next.add(channel);
      return next;
    });
  }

  if (!result.found) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
        <Phone className="mx-auto h-8 w-8 text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">
          No sales records found for{" "}
          <span className="font-mono font-medium text-slate-700">
            {result.query}
          </span>
        </p>
      </div>
    );
  }

  const label = result.type === "nmi" ? "NMI / MIRN" : "Phone";
  const dncOnly = inDnc && result.channels.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 mr-1">
            {label}
          </span>
          <span
            className={cls(
              "font-mono font-medium",
              inDnc ? "text-red-600" : "text-slate-900",
            )}
          >
            {result.query}
          </span>
          {!dncOnly && (
            <>
              {" — found in "}
              <span className="font-medium text-indigo-600">
                {result.channels.length}
              </span>{" "}
              {result.channels.length === 1 ? "channel" : "channels"}
              {inDnc && (
                <span className="ml-1 font-medium text-red-600">+ DNC</span>
              )}
            </>
          )}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {inDnc && result.channels.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <Ban className="h-4 w-4 shrink-0 text-red-600" />
          This number is on the DNC List.
        </div>
      )}

      {dncOnly && <DncOnlyCard phone={result.query} />}

      {result.channels.map((ch) => {
        const isOpen = !closedChannels.has(ch.channel);

        return (
          <div
            key={ch.channel}
            className="rounded-xl border border-slate-200 bg-white overflow-hidden"
          >
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
              onClick={() => toggleChannel(ch.channel)}
            >
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                <span className="font-medium text-slate-800 text-sm">
                  {ch.channel}
                </span>
                <span className="rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium px-2 py-0.5">
                  {ch.count} {ch.count === 1 ? "sale" : "sales"}
                </span>
              </div>
              <ChevronRight
                className={cls(
                  "h-4 w-4 text-slate-400 transition-transform",
                  isOpen && "rotate-90",
                )}
              />
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 overflow-x-auto">
                <table className="w-full min-w-max text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        Phone
                      </th>
                      {showDncColumn && (
                        <th className="px-4 py-2 text-left text-xs font-semibold text-red-600 uppercase tracking-wide whitespace-nowrap">
                          Present in DNC
                        </th>
                      )}
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        NMI / MIRN
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        Sale Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        Center Name
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        Campaign Name
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ch.records.map((r) => (
                      <tr
                        key={`${r.phone}-${r.sale_date ?? ""}-${r.nmi ?? ""}`}
                        className="hover:bg-slate-50"
                      >
                        <td
                          className={cls(
                            "px-4 py-2.5 font-mono text-xs whitespace-nowrap",
                            inDnc ? "text-red-600 font-semibold" : "text-slate-700",
                          )}
                        >
                          {r.phone}
                        </td>
                        {showDncColumn && (
                          <td className="px-4 py-2.5 text-xs font-semibold text-red-600">
                            Yes
                          </td>
                        )}
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600 whitespace-nowrap">
                          {r.nmi ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                          {formatDate(r.sale_date)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                          {r.center_name ?? (
                            <span className="text-slate-300 italic">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                          {r.campaign_name ?? (
                            <span className="text-slate-300 italic">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
