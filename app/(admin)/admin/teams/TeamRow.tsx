"use client";

import { useState } from "react";

type Player = { id: string; firstName: string; lastName: string };
type TeamPlayer = {
  id: string;
  playerId: string;
  jerseyNumber: number | null;
  isPrimary?: boolean;
  additionalFeePaid?: boolean;
  player: Player;
};
type CompetitionRef = { id: string; name: string; season: string };
type CompetitionTeam = { id: string; teamId: string; competition: CompetitionRef };

type Team = {
  id: string;
  name: string;
  contactName?: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  kitShirt?: string | null;
  kitShorts?: string | null;
  kitSocks?: string | null;
  _count: { players: number };
  competitions: CompetitionTeam[];
  players: TeamPlayer[];
  officials?: Official[];
};

type Competition = { id: string; name: string; season: string };
type Official = { id: string; firstName: string; lastName: string; role: string; teamId: string | null };

function TeamDetails({ team, onUpdated }: { team: Team; onUpdated: (t: Team) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    contactName: team.contactName ?? "",
    contactEmail: team.contactEmail ?? "",
    contactPhone: team.contactPhone ?? "",
    kitShirt: team.kitShirt ?? "",
    kitShorts: team.kitShorts ?? "",
    kitSocks: team.kitSocks ?? "",
  });

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/admin/teams/${team.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) return;
    const updated = await res.json();
    onUpdated({ ...team, ...updated });
    setEditing(false);
  };

  if (!editing) {
    const contact = [team.contactName, team.contactEmail, team.contactPhone].filter(Boolean).join(" · ");
    const kit = [team.kitShirt, team.kitShorts, team.kitSocks].filter(Boolean).join(" / ");
    return (
      <p className="text-xs text-muted mt-2">
        {contact && <span>👤 {contact}</span>}
        {contact && kit && <span> &nbsp;·&nbsp; </span>}
        {kit && <span>👕 {kit}</span>}
        {!contact && !kit && <span className="italic">No contact or kit details yet.</span>}
        <button onClick={() => setEditing(true)} className="ml-2 text-brand font-semibold hover:underline">
          Edit
        </button>
      </p>
    );
  }

  const field = (key: keyof typeof form, label: string) => (
    <div>
      <label className="block text-[10px] font-semibold text-muted mb-0.5">{label}</label>
      <input
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="border border-border rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand"
      />
    </div>
  );

  return (
    <div className="mt-2 bg-white border border-border rounded-lg p-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
        {field("contactName", "Contact name")}
        {field("contactEmail", "Contact email")}
        {field("contactPhone", "Contact phone")}
        {field("kitShirt", "Shirt")}
        {field("kitShorts", "Shorts")}
        {field("kitSocks", "Socks")}
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className="bg-brand text-white px-3 py-1 rounded text-xs font-semibold hover:bg-brand-dark disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} className="border border-border px-2 py-1 rounded text-xs hover:border-brand">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function TeamRow({
  team,
  allPlayers,
  allCompetitions,
  allOfficials,
  onUpdated,
  onDeleted,
}: {
  team: Team;
  allPlayers: Player[];
  allCompetitions: Competition[];
  allOfficials: Official[];
  onUpdated: (t: Team) => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addPlayerForm, setAddPlayerForm] = useState({ playerId: "", jerseyNumber: "" });
  const [addCompForm, setAddCompForm] = useState(allCompetitions[0]?.id ?? "");
  const [playerSaving, setPlayerSaving] = useState(false);
  const [compSaving, setCompSaving] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [compError, setCompError] = useState("");

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addPlayerForm.playerId) return;
    setPlayerSaving(true);
    setPlayerError("");
    const res = await fetch(`/api/admin/teams/${team.id}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: addPlayerForm.playerId, jerseyNumber: addPlayerForm.jerseyNumber || null }),
    });
    const data = await res.json();
    setPlayerSaving(false);
    if (!res.ok) { setPlayerError(data.error ?? "Failed"); return; }
    onUpdated({
      ...team,
      players: [...team.players, data],
      _count: { players: team._count.players + 1 },
    });
    setAddPlayerForm({ playerId: "", jerseyNumber: "" });
  };

  const handleToggleFee = async (tp: TeamPlayer) => {
    const res = await fetch(`/api/admin/teams/${team.id}/players`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: tp.playerId, additionalFeePaid: !tp.additionalFeePaid }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    onUpdated({
      ...team,
      players: team.players.map((p) => (p.playerId === tp.playerId ? { ...p, ...updated } : p)),
    });
  };

  const handleRemovePlayer = async (playerId: string) => {
    await fetch(`/api/admin/teams/${team.id}/players?playerId=${playerId}`, { method: "DELETE" });
    onUpdated({
      ...team,
      players: team.players.filter((p) => p.playerId !== playerId),
      _count: { players: team._count.players - 1 },
    });
  };

  const [officialId, setOfficialId] = useState("");
  const [officialSaving, setOfficialSaving] = useState(false);

  const handleAddOfficial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officialId) return;
    setOfficialSaving(true);
    const res = await fetch(`/api/admin/teams/${team.id}/officials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ officialId }),
    });
    setOfficialSaving(false);
    if (!res.ok) return;
    const official = await res.json();
    onUpdated({ ...team, officials: [...(team.officials ?? []), official] });
    setOfficialId("");
  };

  const handleRemoveOfficial = async (id: string) => {
    await fetch(`/api/admin/teams/${team.id}/officials?officialId=${id}`, { method: "DELETE" });
    onUpdated({ ...team, officials: (team.officials ?? []).filter((o) => o.id !== id) });
  };

  const handleAddToComp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addCompForm) return;
    setCompSaving(true);
    setCompError("");
    const res = await fetch(`/api/admin/teams/${team.id}/competitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitionId: addCompForm }),
    });
    const data = await res.json();
    setCompSaving(false);
    if (!res.ok) { setCompError(data.error ?? "Failed"); return; }
    onUpdated({ ...team, competitions: [...team.competitions, data] });
  };

  const handleDelete = async () => {
    if (!confirm(`Delete team "${team.name}"?`)) return;
    await fetch(`/api/admin/teams/${team.id}`, { method: "DELETE" });
    onDeleted(team.id);
  };

  const availablePlayers = allPlayers.filter(
    (p) => !team.players.some((tp) => tp.playerId === p.id)
  );
  const availableComps = allCompetitions.filter(
    (c) => !team.competitions.some((tc) => tc.competition.id === c.id)
  );

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <span className="font-semibold text-navy text-sm">{team.name}</span>
          <span className="ml-2 text-xs text-muted">{team._count.players} players</span>
          {team.competitions.length > 0 && (
            <span className="ml-2 text-xs text-muted">
              · {team.competitions.map((c) => c.competition.name).join(", ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={handleDelete} className="bg-red-500 text-white px-3 py-1.5 rounded text-xs hover:bg-red-600">
            Delete
          </button>
          <span className="text-muted text-sm select-none">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 bg-gray-50 border-t border-border">
          {/* Contact + kit details */}
          <TeamDetails team={team} onUpdated={onUpdated} />

          {/* Player roster */}
          <div className="mt-3">
            <p className="text-xs font-bold text-navy uppercase tracking-wide mb-2">Players</p>
            {team.players.length === 0 ? (
              <p className="text-xs text-muted mb-2">No players yet.</p>
            ) : (
              <table className="text-xs w-full mb-2">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="pb-1 font-semibold">Name</th>
                    <th className="pb-1 font-semibold w-16">#</th>
                    <th className="pb-1 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {team.players.map((tp) => (
                    <tr key={tp.id}>
                      <td className="py-1">
                        {tp.player.firstName} {tp.player.lastName}
                        {tp.isPrimary === false && (
                          <button
                            onClick={() => handleToggleFee(tp)}
                            title="Additional team — click to toggle the $135 fee as paid/unpaid"
                            className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                              tp.additionalFeePaid
                                ? "bg-green-50 border-green-300 text-green-700"
                                : "bg-amber-50 border-amber-300 text-amber-700"
                            }`}
                          >
                            2nd team · {tp.additionalFeePaid ? "$135 paid" : "$135 owing"}
                          </button>
                        )}
                      </td>
                      <td className="py-1 text-muted">{tp.jerseyNumber ?? "—"}</td>
                      <td className="py-1">
                        <button
                          onClick={() => handleRemovePlayer(tp.playerId)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {availablePlayers.length > 0 && (
              <form onSubmit={handleAddPlayer} className="flex gap-2 items-center flex-wrap mt-1">
                <select
                  value={addPlayerForm.playerId}
                  onChange={(e) => setAddPlayerForm((f) => ({ ...f, playerId: e.target.value }))}
                  className="border border-border rounded px-2 py-1.5 text-xs focus:outline-none"
                >
                  <option value="">Select player…</option>
                  {availablePlayers.map((p) => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Jersey #"
                  value={addPlayerForm.jerseyNumber}
                  onChange={(e) => setAddPlayerForm((f) => ({ ...f, jerseyNumber: e.target.value }))}
                  className="border border-border rounded px-2 py-1.5 text-xs w-20 focus:outline-none"
                />
                <button type="submit" disabled={playerSaving || !addPlayerForm.playerId}
                  className="bg-brand text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-brand-dark disabled:opacity-60">
                  {playerSaving ? "Adding…" : "Add Player"}
                </button>
                {playerError && <span className="text-xs text-red-600">{playerError}</span>}
              </form>
            )}
          </div>

          {/* Officials (coach / manager) */}
          <div className="mt-4">
            <p className="text-xs font-bold text-navy uppercase tracking-wide mb-2">Coach / Manager</p>
            {(team.officials ?? []).length === 0 ? (
              <p className="text-xs text-amber-700 mb-2">
                ⚠ No registered official yet — every team needs one (rule 1.3).
              </p>
            ) : (
              <ul className="text-xs mb-2 space-y-1">
                {(team.officials ?? []).map((o) => (
                  <li key={o.id} className="flex items-center gap-2">
                    <span>{o.firstName} {o.lastName}</span>
                    <span className="text-[10px] font-bold bg-navy/10 text-navy px-1.5 py-0.5 rounded-full capitalize">
                      {o.role.toLowerCase()}
                    </span>
                    <button onClick={() => handleRemoveOfficial(o.id)} className="text-red-500 hover:text-red-700">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {allOfficials.some((o) => !o.teamId) && (
              <form onSubmit={handleAddOfficial} className="flex gap-2 items-center flex-wrap">
                <select
                  value={officialId}
                  onChange={(e) => setOfficialId(e.target.value)}
                  className="border border-border rounded px-2 py-1.5 text-xs focus:outline-none"
                >
                  <option value="">Select coach/manager…</option>
                  {allOfficials.filter((o) => !o.teamId).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.firstName} {o.lastName} ({o.role.toLowerCase()})
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={officialSaving || !officialId}
                  className="bg-brand text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-brand-dark disabled:opacity-60">
                  {officialSaving ? "Adding…" : "Assign"}
                </button>
              </form>
            )}
          </div>

          {/* Add to competition */}
          {availableComps.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold text-navy uppercase tracking-wide mb-2">Add to Competition</p>
              <form onSubmit={handleAddToComp} className="flex gap-2 items-center flex-wrap">
                <select
                  value={addCompForm}
                  onChange={(e) => setAddCompForm(e.target.value)}
                  className="border border-border rounded px-2 py-1.5 text-xs focus:outline-none"
                >
                  {availableComps.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.season})</option>
                  ))}
                </select>
                <button type="submit" disabled={compSaving}
                  className="bg-brand text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-brand-dark disabled:opacity-60">
                  {compSaving ? "Adding…" : "Add to Competition"}
                </button>
                {compError && <span className="text-xs text-red-600">{compError}</span>}
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
