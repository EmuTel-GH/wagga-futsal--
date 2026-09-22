"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getMyTeams, saveMyTeams } from "@/components/public/MyTeamsWidget";

interface Result {
  id: string;
  name: string;
  competition: string | null;
}

// Find-your-team search (dark style for the homepage hero). Selecting a team
// pins it to "My Teams" (up to 5 — kids in multiple teams, multi-team players)
// and opens the team page.
export default function TeamSearch({ placeholder = "Find your team…" }: { placeholder?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/teams/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data);
      setOpen(true);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const select = (team: Result) => {
    const current = getMyTeams();
    if (!current.some((t) => t.id === team.id) && current.length < 5) {
      saveMyTeams([...current, { id: team.id, name: team.name }]);
    }
    setOpen(false);
    setQuery("");
    router.push(`/teams/${team.id}`);
  };

  return (
    <div ref={ref} className="relative w-full max-w-lg">
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-lg">🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder-white/40 border border-white/20 focus:border-brand rounded-xl pl-11 pr-4 py-3.5 outline-none transition-all text-sm"
        />
        {loading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-xs animate-pulse">
            searching…
          </span>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-border overflow-hidden z-50">
          {results.map((t) => (
            <button
              key={t.id}
              onClick={() => select(t)}
              className="w-full text-left px-4 py-3 hover:bg-navy/5 transition-colors border-b border-border last:border-0"
            >
              <p className="font-bold text-navy text-sm">{t.name}</p>
              {t.competition && <p className="text-xs text-muted">{t.competition}</p>}
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && query.length >= 2 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-border p-4 z-50">
          <p className="text-muted text-sm text-center">No teams found for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
