"use client";

import { useEffect, useState } from "react";
import { getMyTeams, saveMyTeams, MAX_MY_TEAMS } from "./MyTeamsWidget";

// ⭐ Save / Saved toggle for "My Teams" (kept in this browser only).
export default function SaveTeamButton({ team }: { team: { id: string; name: string } }) {
  const [saved, setSaved] = useState(false);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const refresh = () => setSaved(getMyTeams().some((t) => t.id === team.id));
    refresh();
    window.addEventListener("myteams-changed", refresh);
    return () => window.removeEventListener("myteams-changed", refresh);
  }, [team.id]);

  const toggle = () => {
    const current = getMyTeams();
    if (saved) return saveMyTeams(current.filter((t) => t.id !== team.id));
    if (current.length >= MAX_MY_TEAMS) return setFull(true);
    saveMyTeams([...current, team]);
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={toggle}
        className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${saved ? "bg-brand text-white hover:bg-brand-dark" : "bg-white border border-brand text-brand hover:bg-brand/5"}`}>
        {saved ? "⭐ Saved to My Teams" : "☆ Save team"}
      </button>
      {full && <span className="text-xs text-muted">You can save up to {MAX_MY_TEAMS} teams.</span>}
    </span>
  );
}
