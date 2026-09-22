"use client";

import { useState, useEffect } from "react";

type Player = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  playFootballId: string | null;
  registeredAgeGroup: string | null;
  teamPlayers?: { isPrimary: boolean; team: { name: string } }[];
};

type ImportSummary = {
  players: number;
  officials: number;
  referees: number;
  skipped: number;
  errors: string[];
};

export default function PlayersAdmin() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [search, setSearch] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  useEffect(() => {
    fetch("/api/admin/players?" + new URLSearchParams({ q: search, unassigned: unassignedOnly ? "1" : "" }))
      .then((r) => r.json())
      .then(setPlayers)
      .catch(() => {});
  }, [search, unassignedOnly]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/players/import", { method: "POST", body: form });
    const data = await res.json();
    setImportResult(data);
    setImporting(false);

    if (res.ok) {
      // Refresh list
      fetch("/api/admin/players").then((r) => r.json()).then(setPlayers);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-black text-navy">Players</h1>
        <label className={`cursor-pointer bg-brand hover:bg-brand-dark text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors ${importing ? "opacity-60" : ""}`}>
          {importing ? "Importing…" : "Import CSV"}
          <input type="file" accept=".csv" className="sr-only" onChange={handleImport} disabled={importing} />
        </label>
      </div>

      <p className="text-xs text-muted mb-4">
        Players come from the PlayFootball registration import — re-import any time to pick up new
        registrations. Assign players to squads from the <a href="/admin/teams" className="text-brand font-semibold hover:underline">Teams</a> page.
      </p>

      {importResult && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-lg mb-4">
          <p className="font-semibold">
            Imported {importResult.players} players, {importResult.officials} coaches/managers,{" "}
            {importResult.referees} referees{importResult.skipped > 0 ? ` · ${importResult.skipped} skipped` : ""}.
          </p>
          {importResult.errors?.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-amber-800 list-disc list-inside">
              {importResult.errors.slice(0, 10).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {importResult.errors.length > 10 && <li>…and {importResult.errors.length - 10} more</li>}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <label className="flex items-center gap-2 text-sm text-navy font-medium whitespace-nowrap cursor-pointer">
          <input
            type="checkbox"
            checked={unassignedOnly}
            onChange={(e) => setUnassignedOnly(e.target.checked)}
            className="accent-[#E91E8C]"
          />
          Unassigned only
        </label>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy text-white">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Name</th>
              <th className="px-4 py-3 text-left font-semibold">DOB</th>
              <th className="px-4 py-3 text-left font-semibold">Age Group</th>
              <th className="px-4 py-3 text-left font-semibold">Gender</th>
              <th className="px-4 py-3 text-left font-semibold">Team(s)</th>
              <th className="px-4 py-3 text-left font-semibold">FFA Number</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {players.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-semibold">{p.firstName} {p.lastName}</td>
                <td className="px-4 py-2.5 text-muted">{new Date(p.dateOfBirth).toLocaleDateString("en-AU")}</td>
                <td className="px-4 py-2.5">
                  <span className="text-xs font-bold bg-navy/10 text-navy px-2 py-0.5 rounded-full">
                    {p.registeredAgeGroup ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted capitalize">{p.gender.toLowerCase()}</td>
                <td className="px-4 py-2.5 text-xs">
                  {p.teamPlayers && p.teamPlayers.length > 0 ? (
                    p.teamPlayers.map((tp, i) => (
                      <span key={i}>
                        {i > 0 && ", "}
                        {tp.team.name}
                        {!tp.isPrimary && <span className="text-amber-700"> (2nd)</span>}
                      </span>
                    ))
                  ) : (
                    <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 font-semibold">
                      Unassigned
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted font-mono text-xs">{p.playFootballId ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {players.length === 0 && (
          <p className="text-center text-muted py-8 text-sm">
            No players yet. Import a CSV from PlayFootball to get started.
          </p>
        )}
      </div>
    </div>
  );
}
