"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

// Pinned teams live in this browser only (localStorage) — most visitors follow
// one or two teams (their own, their kids'). Pins are set from the homepage
// team search; up to 5.
type SavedTeam = { id: string; name: string };

export function getMyTeams(): SavedTeam[] {
  try {
    const raw = localStorage.getItem("myTeams");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMyTeams(teams: SavedTeam[]): void {
  try {
    localStorage.setItem("myTeams", JSON.stringify(teams));
    window.dispatchEvent(new Event("myteams-changed"));
  } catch {}
}

export default function MyTeamsWidget() {
  const [teams, setTeams] = useState<SavedTeam[]>([]);

  useEffect(() => {
    const refresh = () => setTeams(getMyTeams());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("myteams-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("myteams-changed", refresh);
    };
  }, []);

  if (teams.length === 0) return null;

  const unpin = (id: string) => saveMyTeams(getMyTeams().filter((t) => t.id !== id));

  return (
    <section className="bg-brand/5 border-b border-brand/20 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center gap-3 flex-wrap">
        <span className="text-xs font-black text-brand uppercase tracking-widest shrink-0">⭐ My Teams</span>
        {teams.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1.5 bg-white border border-brand/30 hover:border-brand rounded-full pl-4 pr-2 py-1.5 text-sm font-semibold text-navy transition-colors whitespace-nowrap"
          >
            <Link href={`/teams/${t.id}`} className="hover:text-brand">
              {t.name}
            </Link>
            <button
              onClick={() => unpin(t.id)}
              title="Unpin team"
              className="text-muted hover:text-red-500 text-xs px-1"
            >
              ✕
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}
