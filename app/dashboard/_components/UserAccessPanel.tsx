"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield, Users, X } from "lucide-react";
import { cls } from "./utils";

type ManagedUser = {
  id: string;
  email: string;
  hasAccess: boolean;
  isAdmin: boolean;
};

type Props = Readonly<{
  open: boolean;
  onClose: () => void;
}>;

export function UserAccessPanel({ open, onClose }: Props) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/users", { credentials: "include" });
      const data = (await res.json()) as {
        users?: ManagedUser[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed to load users");
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadUsers();
  }, [open, loadUsers]);

  async function setAccess(userId: string, hasAccess: boolean) {
    setUpdatingId(userId);
    setError(null);
    try {
      const res = await fetch("/api/auth/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, hasAccess }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Update failed");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, hasAccess } : u)),
      );
    } catch {
      setError("Network error");
    } finally {
      setUpdatingId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">
              User access
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="px-5 py-3 text-sm text-slate-500 border-b border-slate-50">
          Revoke access to block dashboard login. Users are not deleted from the
          database.
        </p>

        {error && (
          <p className="mx-5 mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-slate-400">
              <Users className="h-8 w-8 mb-2" />
              <p className="text-sm">No users found</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {u.email}
                      </p>
                      {u.isAdmin && (
                        <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                          Admin
                        </span>
                      )}
                    </div>
                    <p
                      className={cls(
                        "text-xs mt-0.5",
                        u.isAdmin
                          ? "text-slate-500"
                          : u.hasAccess
                            ? "text-emerald-600"
                            : "text-red-600",
                      )}
                    >
                      {u.isAdmin
                        ? "Always has access"
                        : u.hasAccess
                          ? "Has access"
                          : "Access revoked"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={u.isAdmin || updatingId === u.id}
                    onClick={() => setAccess(u.id, !u.hasAccess)}
                    className={cls(
                      "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                      u.isAdmin
                        ? "bg-slate-100 text-slate-400"
                        : u.hasAccess
                          ? "bg-red-50 text-red-700 hover:bg-red-100"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                    )}
                  >
                    {u.isAdmin
                      ? "Revoke"
                      : updatingId === u.id
                        ? "…"
                        : u.hasAccess
                          ? "Revoke"
                          : "Restore"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
