"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import { DashboardHeader } from "./_components/DashboardHeader";
import { EmptyState } from "./_components/EmptyState";
import { ImportModal } from "./_components/ImportModal";
import { SearchBar } from "./_components/SearchBar";
import { SearchResults } from "./_components/SearchResults";
import type { SearchResult, User } from "./_components/types";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const [searchMode, setSearchMode] = useState<"phone" | "nmi">("phone");
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) {
        router.replace("/");
        return;
      }
      const data = (await res.json()) as { user: User | null };
      if (!data.user) {
        router.replace("/");
        return;
      }
      setUser(data.user);
      setReady(true);
    })().catch(() => router.replace("/"));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/");
  }

  function handleModeChange(mode: "phone" | "nmi") {
    setSearchMode(mode);
    setSearchInput("");
    setSearchResult(null);
    setSearchError(null);
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setSearching(true);
    setSearchResult(null);
    setSearchError(null);
    try {
      const param = searchMode === "phone" ? "phone" : "nmi";
      const res = await fetch(
        `/api/sales/search?${param}=${encodeURIComponent(searchInput.trim())}`,
        { credentials: "include" },
      );
      const data = (await res.json()) as SearchResult & { error?: string };
      if (!res.ok) {
        setSearchError(data.error ?? "Search failed");
        return;
      }
      setSearchResult(data);
    } catch {
      setSearchError("Network error");
    } finally {
      setSearching(false);
    }
  }

  if (!ready) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <DashboardHeader
        user={user}
        onImport={() => setShowModal(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto p-6 pb-10 space-y-6">
        <SearchBar
          searchMode={searchMode}
          searchInput={searchInput}
          searching={searching}
          onModeChange={handleModeChange}
          onInputChange={setSearchInput}
          onSubmit={handleSearch}
        />

        {searchError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {searchError}
          </div>
        )}

        {searchResult ? (
          <SearchResults
            result={searchResult}
            onClose={() => setSearchResult(null)}
          />
        ) : (
          !searchError && <EmptyState onImport={() => setShowModal(true)} />
        )}
      </main>

      {showModal && (
        <ImportModal
          onClose={() => setShowModal(false)}
          onImported={() => {}}
        />
      )}
    </div>
  );
}
