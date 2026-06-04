"use client";

import { LogOut, Megaphone, Shield, Upload } from "lucide-react";
import type { User } from "./types";

type Props = Readonly<{
  user: User | null;
  onImport: () => void;
  onLogout: () => void;
  onManageUsers?: () => void;
}>;

export function DashboardHeader({
  user,
  onImport,
  onLogout,
  onManageUsers,
}: Props) {
  return (
    <header className="shrink-0 flex items-center justify-between h-14 px-4 bg-white border-b border-slate-200 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
          <Megaphone className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold text-slate-900 tracking-tight">
          Lead Trace
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onImport}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
        >
          <Upload className="h-3.5 w-3.5" />
          Import Excel
        </button>
        {user?.isAdmin && onManageUsers && (
          <button
            type="button"
            onClick={onManageUsers}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition-colors"
          >
            <Shield className="h-3.5 w-3.5" />
            Users
          </button>
        )}
        <div className="h-4 w-px bg-slate-200 mx-1" />
        <span className="text-xs text-slate-500 hidden sm:block">
          {user?.email}
        </span>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:block">Logout</span>
        </button>
      </div>
    </header>
  );
}
