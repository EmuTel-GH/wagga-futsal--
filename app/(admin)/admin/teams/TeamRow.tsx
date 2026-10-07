"use client";

import { useState } from "react";
import { reviewExpected, type ExpectedReview } from "@/lib/eligibility";

type AgeGroup = "U5" | "U6" | "U7" | "U8" | "U9" | "U10" | "U11" | "U12" | "U14" | "U16" | "U19" | "OPENS" | "SOCIAL";
type Gender = "MALE" | "FEMALE" | "MIXED";
type DispensationType = "PLAY_UP" | "PLAY_DOWN" | "OVERRIDE";

export type Player = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | string;
  gender: Gender;
  registeredAgeGroup: AgeGroup | null;
};
export type Dispensation = {
  id: string;
  playerId: string;
  competitionId: string;
  type: DispensationType;
  approvedBy: string;
  note: string | null;
};
type TeamPlayer = {
  id: string;
  playerId: string;
  jerseyNumber: number | null;
  isPrimary?: boolean;
  additionalFeePaid?: boolean;
  player: Player;
};
type CompetitionRef = { id: string; name: string; season: string; ageGroup: AgeGroup; gender: Gender };
type CompetitionTeam = { id: string; teamId: string; competition: CompetitionRef };

export type Team = {
  id: string;
  name: string;
  status?: string;
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
  expected?: Expected[];
};

type Competition = { id: string; name: string; season: string };
type Official = { id: string; firstName: string; lastName: string; role: string; teamId: string | null };
type Expected = {
  id: string;
  firstName: string;
  lastName: string;
  rejectedAt?: Date | string | null;
  rejectedBy?: string | null;
  rejectReason?: string | null;
};

const DISPENSATION_LABEL: Record<DispensationType, string> = {
  PLAY_UP: "Play-up approved",
  PLAY_DOWN: "Play-down approved",
  OVERRIDE: "Rules overridden",
};

function reviewTeam(team: Team, allPlayers: Player[], dispensations: Dispensation[]) {
  const competition = team.competitions[0]?.competition ?? null;
  const rosterPlayerIds = team.players.map((p) => p.playerId);
  return (team.expected ?? []).map((ex) => ({
    ex,
    review: reviewExpected({ expected: ex, players: allPlayers, rosterPlayerIds, competition, dispensations }),
  }));
}

/** Pending nomination, or expected players an admin must authorise/reject. */
export function teamNeedsReview(team: Team, allPlayers: Player[], dispensations: Dispensation[]) {
  return team.status === "PENDING" || reviewTeam(team, allPlayers, dispensations).some((r) => r.review.state === "INELIGIBLE");
}

// Inline "reason" prompt used for overrides, authorisations and rejections.
function ReasonPrompt({
  message,
  confirmLabel,
  tone,
  required,
  busy,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  tone: "approve" | "reject";
  required: boolean;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className={`mt-1 mb-2 rounded-lg border p-2.5 ${tone === "approve" ? "bg-amber-50 border-amber-300" : "bg-red-50 border-red-200"}`}>
      <p className="text-xs text-navy mb-1.5">{message}</p>
      <div className="flex flex-wrap gap-2 items-center">
        <input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={required ? "Reason (required — recorded in the audit log)" : "Reason (optional)"}
          className="border border-border rounded px-2 py-1.5 text-xs flex-1 min-w-[14rem] focus:outline-none focus:ring-1 focus:ring-brand bg-white"
        />
        <button
          disabled={busy || (required && reason.trim().length < 3)}
          onClick={() => onConfirm(reason.trim())}
          className={`px-3 py-1.5 rounded text-xs font-bold text-white disabled:opacity-60 ${tone === "approve" ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"}`}
        >
          {busy ? "Saving…" : confirmLabel}
        </button>
        <button onClick={onCancel} className="border border-border bg-white px-2 py-1.5 rounded text-xs hover:border-brand">
          Cancel
        </button>
      </div>
    </div>
  );
}

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
  allTeams,
  allPlayers,
  allCompetitions,
  allOfficials,
  dispensations,
  canOverride,
  onUpdated,
  onDeleted,
  onDispensations,
}: {
  team: Team;
  allTeams: Team[];
  allPlayers: Player[];
  allCompetitions: Competition[];
  allOfficials: Official[];
  dispensations: Dispensation[];
  canOverride: boolean;
  onUpdated: (t: Team) => void;
  onDeleted: (id: string) => void;
  onDispensations: (d: Dispensation[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addPlayerForm, setAddPlayerForm] = useState({ playerId: "", jerseyNumber: "" });
  const [playerQuery, setPlayerQuery] = useState("");
  const [addCompForm, setAddCompForm] = useState(allCompetitions[0]?.id ?? "");
  const [playerSaving, setPlayerSaving] = useState(false);
  const [compSaving, setCompSaving] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [compError, setCompError] = useState("");

  // A rule block the current admin may override: { playerId, jersey, message }.
  const [blocked, setBlocked] = useState<{ playerId: string; jerseyNumber: string | null; message: string; from: "search" | "expected" } | null>(null);
  const [overrideBusy, setOverrideBusy] = useState(false);

  // POST the player; on a rule block, either show the error or offer an override.
  const addPlayer = async (
    playerId: string,
    jerseyNumber: string | null,
    from: "search" | "expected",
    overrideReason?: string
  ): Promise<string | null> => {
    const res = await fetch(`/api/admin/teams/${team.id}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId,
        jerseyNumber,
        ...(overrideReason ? { override: { reason: overrideReason } } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 409 && data.overridable && !overrideReason) {
        setBlocked({ playerId, jerseyNumber, message: data.error, from });
        return null;
      }
      return data.error ?? "Failed";
    }
    const { dispensations: added, ...teamPlayer } = data;
    if (added?.length) onDispensations(added);
    onUpdated({
      ...team,
      players: [...team.players, teamPlayer],
      _count: { players: team._count.players + 1 },
    });
    setBlocked(null);
    return null;
  };

  const handleOverride = async (reason: string) => {
    if (!blocked) return;
    setOverrideBusy(true);
    const err = await addPlayer(blocked.playerId, blocked.jerseyNumber, blocked.from, reason);
    setOverrideBusy(false);
    if (err) (blocked.from === "search" ? setPlayerError : setExpectedError)(err);
    else if (blocked.from === "search") {
      setAddPlayerForm({ playerId: "", jerseyNumber: "" });
      setPlayerQuery("");
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addPlayerForm.playerId) return;
    setPlayerSaving(true);
    setPlayerError("");
    setBlocked(null);
    const err = await addPlayer(addPlayerForm.playerId, addPlayerForm.jerseyNumber || null, "search");
    setPlayerSaving(false);
    if (err) { setPlayerError(err); return; }
    setAddPlayerForm({ playerId: "", jerseyNumber: "" });
    setPlayerQuery("");
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
  const [mergeTarget, setMergeTarget] = useState("");
  const [mergeBusy, setMergeBusy] = useState(false);

  const isPending = team.status === "PENDING";
  const myCompIds = team.competitions.map((c) => c.competition.id);
  const mergeCandidates = allTeams.filter(
    (t) =>
      t.id !== team.id &&
      t.status !== "PENDING" &&
      t.competitions.some((c) => myCompIds.includes(c.competition.id))
  );

  const [approveError, setApproveError] = useState("");
  const handleApprove = async () => {
    setApproveError("");
    const res = await fetch(`/api/admin/teams/${team.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    if (res.ok) onUpdated({ ...team, status: "APPROVED" });
    else setApproveError((await res.json()).error ?? "Failed");
  };

  const handleMerge = async () => {
    if (!mergeTarget) return;
    const target = allTeams.find((t) => t.id === mergeTarget);
    if (!confirm(`Merge "${team.name}" into "${target?.name}"? Contact/kit details and players move across, then this nomination is removed.`)) return;
    setMergeBusy(true);
    const res = await fetch(`/api/admin/teams/${team.id}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetTeamId: mergeTarget }),
    });
    setMergeBusy(false);
    if (res.ok) window.location.reload();
  };

  const [expectedOpen, setExpectedOpen] = useState(false);
  const [expectedText, setExpectedText] = useState("");
  const [expectedSaving, setExpectedSaving] = useState(false);
  const [expectedError, setExpectedError] = useState("");

  const handleSaveExpected = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpectedSaving(true);
    const res = await fetch(`/api/admin/teams/${team.id}/expected`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: expectedText }),
    });
    setExpectedSaving(false);
    if (!res.ok) return;
    const expected = await res.json();
    onUpdated({ ...team, expected });
    setExpectedOpen(false);
  };

  // Each expected name: registered? in the team? eligible for the team's competition?
  const reviews = reviewTeam(team, allPlayers, dispensations);
  const flagged = reviews.filter((r) => r.review.state === "INELIGIBLE");
  const competitionId = team.competitions[0]?.competition.id;
  const dispensationFor = (playerId: string) =>
    dispensations.find((d) => d.playerId === playerId && d.competitionId === competitionId);

  const handleQuickAdd = async (playerId: string) => {
    setExpectedError("");
    setBlocked(null);
    const err = await addPlayer(playerId, null, "expected");
    if (err) setExpectedError(err);
  };

  // Authorise / reject an ineligible nominated player.
  const [reviewing, setReviewing] = useState<{ expectedId: string; action: "authorise" | "reject" } | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

  const handleAuthorise = async (playerId: string, reason: string) => {
    setReviewBusy(true);
    setExpectedError("");
    const err = await addPlayer(playerId, null, "expected", reason);
    setReviewBusy(false);
    if (err) setExpectedError(err);
    else setReviewing(null);
  };

  const setRejected = async (expectedId: string, rejected: boolean, reason?: string) => {
    setReviewBusy(true);
    setExpectedError("");
    const res = await fetch(`/api/admin/teams/${team.id}/expected`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedId, rejected, reason }),
    });
    const data = await res.json();
    setReviewBusy(false);
    if (!res.ok) return setExpectedError(data.error ?? "Failed");
    onUpdated({ ...team, expected: (team.expected ?? []).map((x) => (x.id === expectedId ? { ...x, ...data } : x)) });
    setReviewing(null);
  };

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
          {isPending && (
            <span className="ml-2 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              Pending approval
            </span>
          )}
          {flagged.length > 0 && (
            <span className="ml-2 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              {flagged.length} ineligible to review
            </span>
          )}
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
          {/* Pending nomination: approve or merge */}
          {isPending && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800 font-semibold mb-2">
                Public team nomination — approve it as a new team, or merge it into an existing one.
              </p>
              {flagged.length > 0 && (
                <p className="text-xs text-red-700 mb-2">
                  {flagged.length} nominated player{flagged.length === 1 ? " is" : "s are"} not eligible for this
                  competition. Authorise or reject {flagged.length === 1 ? "them" : "each one"} under Expected Squad
                  before approving the team.
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleApprove}
                  disabled={flagged.length > 0}
                  title={flagged.length > 0 ? "Review the ineligible players first" : undefined}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Approve team
                </button>
                {mergeCandidates.length > 0 && (
                  <>
                    <span className="text-xs text-muted">or merge into</span>
                    <select
                      value={mergeTarget}
                      onChange={(e) => setMergeTarget(e.target.value)}
                      className="border border-border rounded px-2 py-1.5 text-xs focus:outline-none"
                    >
                      <option value="">Select team…</option>
                      {mergeCandidates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleMerge}
                      disabled={mergeBusy || !mergeTarget}
                      className="bg-navy text-white px-3 py-1.5 rounded text-xs font-bold disabled:opacity-60"
                    >
                      {mergeBusy ? "Merging…" : "Merge"}
                    </button>
                  </>
                )}
              </div>
              {approveError && <p className="text-xs text-red-600 mt-2">{approveError}</p>}
            </div>
          )}

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
                        {(() => {
                          const d = dispensationFor(tp.playerId);
                          return d ? (
                            <span
                              title={`Approved by ${d.approvedBy}${d.note ? ` — ${d.note}` : ""}`}
                              className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-amber-50 border-amber-300 text-amber-700"
                            >
                              {DISPENSATION_LABEL[d.type]} · {d.approvedBy}
                            </span>
                          ) : null;
                        })()}
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
              <form onSubmit={handleAddPlayer} className="mt-1">
                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    type="text"
                    placeholder="Search player by name…"
                    value={playerQuery}
                    onChange={(e) => {
                      setPlayerQuery(e.target.value);
                      setAddPlayerForm((f) => ({ ...f, playerId: "" }));
                    }}
                    className="border border-border rounded px-2 py-1.5 text-xs w-52 focus:outline-none focus:ring-1 focus:ring-brand"
                  />
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
                </div>
                {blocked?.from === "search" && (
                  <ReasonPrompt
                    message={`${blocked.message} You can approve this placement anyway.`}
                    confirmLabel="Approve & add anyway"
                    tone="approve"
                    required
                    busy={overrideBusy}
                    onConfirm={handleOverride}
                    onCancel={() => setBlocked(null)}
                  />
                )}
                {playerQuery.length >= 2 && !addPlayerForm.playerId && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {availablePlayers
                      .filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(playerQuery.toLowerCase()))
                      .slice(0, 8)
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setAddPlayerForm((f) => ({ ...f, playerId: p.id }));
                            setPlayerQuery(`${p.firstName} ${p.lastName}`);
                          }}
                          className="bg-white border border-border rounded-full px-2.5 py-1 text-xs hover:border-brand hover:text-brand"
                        >
                          {p.firstName} {p.lastName}
                        </button>
                      ))}
                  </div>
                )}
              </form>
            )}
          </div>

          {/* Expected squad (from the team registration form) */}
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-bold text-navy uppercase tracking-wide">Expected Squad</p>
              <button
                onClick={() => { setExpectedText((team.expected ?? []).map((x) => `${x.firstName} ${x.lastName}`.trim()).join("\n")); setExpectedOpen((v) => !v); }}
                className="text-xs text-brand font-semibold hover:underline"
              >
                {expectedOpen ? "Cancel" : (team.expected ?? []).length > 0 ? "Edit list" : "Paste from registration form"}
              </button>
            </div>

            {expectedOpen ? (
              <form onSubmit={handleSaveExpected} className="mb-2">
                <textarea
                  value={expectedText}
                  onChange={(e) => setExpectedText(e.target.value)}
                  rows={6}
                  placeholder={"One player per line, e.g.\nHarrison Heller\nLoch Wealands"}
                  className="w-full border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
                />
                <button type="submit" disabled={expectedSaving}
                  className="mt-1 bg-brand text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-brand-dark disabled:opacity-60">
                  {expectedSaving ? "Saving…" : "Save expected squad"}
                </button>
              </form>
            ) : (team.expected ?? []).length === 0 ? (
              <p className="text-xs text-muted mb-1">
                None recorded — paste the player list from the team&apos;s registration form.
              </p>
            ) : (
              <ul className="text-xs mb-1 space-y-1">
                {reviews.map(({ ex, review }) => (
                  <ExpectedItem
                    key={ex.id}
                    ex={ex}
                    review={review}
                    canOverride={canOverride}
                    dispensation={"player" in review ? dispensationFor(review.player.id) : undefined}
                    reviewing={reviewing?.expectedId === ex.id ? reviewing.action : null}
                    blockedMessage={blocked?.from === "expected" && "player" in review && blocked.playerId === review.player.id ? blocked.message : null}
                    busy={reviewBusy || overrideBusy}
                    onAdd={(playerId) => handleQuickAdd(playerId)}
                    onStartReview={(action) => setReviewing({ expectedId: ex.id, action })}
                    onCancelReview={() => { setReviewing(null); setBlocked(null); }}
                    onAuthorise={(playerId, reason) => handleAuthorise(playerId, reason)}
                    onOverride={handleOverride}
                    onReject={(reason) => setRejected(ex.id, true, reason)}
                    onUnreject={() => setRejected(ex.id, false)}
                  />
                ))}
              </ul>
            )}
            {expectedError && <p className="text-xs text-red-600">{expectedError}</p>}
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

function ExpectedItem({
  ex,
  review,
  canOverride,
  dispensation,
  reviewing,
  blockedMessage,
  busy,
  onAdd,
  onStartReview,
  onCancelReview,
  onAuthorise,
  onOverride,
  onReject,
  onUnreject,
}: {
  ex: Expected;
  review: ExpectedReview;
  canOverride: boolean;
  dispensation?: Dispensation;
  reviewing: "authorise" | "reject" | null;
  blockedMessage: string | null;
  busy: boolean;
  onAdd: (playerId: string) => void;
  onStartReview: (action: "authorise" | "reject") => void;
  onCancelReview: () => void;
  onAuthorise: (playerId: string, reason: string) => void;
  onOverride: (reason: string) => void;
  onReject: (reason: string) => void;
  onUnreject: () => void;
}) {
  const name = `${ex.firstName} ${ex.lastName}`.trim();
  const pill = "text-[10px] font-bold px-1.5 py-0.5 rounded-full border";
  const link = "text-brand text-xs font-semibold hover:underline disabled:opacity-60";

  if (review.state === "REJECTED") {
    return (
      <li className="flex items-center gap-2 flex-wrap">
        <span className="line-through text-muted">{name}</span>
        <span className={`${pill} bg-gray-100 border-gray-300 text-gray-600`}>rejected</span>
        <span className="text-muted">
          by {ex.rejectedBy}
          {ex.rejectReason ? ` — ${ex.rejectReason}` : ""}
        </span>
        <button onClick={onUnreject} disabled={busy} className={link}>Undo</button>
      </li>
    );
  }

  return (
    <li>
      <div className="flex items-center gap-2 flex-wrap">
        <span>{name}</span>
        {review.state === "IN_TEAM" && (
          <span className={`${pill} text-green-700 bg-green-50 border-green-200`}>✓ in team</span>
        )}
        {review.state === "UNREGISTERED" && (
          <span className={`${pill} text-red-700 bg-red-50 border-red-200`}>not registered yet</span>
        )}
        {review.state === "ELIGIBLE" && (
          <>
            <span className={`${pill} text-amber-700 bg-amber-50 border-amber-200`}>registered — not in team</span>
            {dispensation && (
              <span className={`${pill} text-amber-700 bg-amber-50 border-amber-300`} title={dispensation.note ?? undefined}>
                {DISPENSATION_LABEL[dispensation.type]} · {dispensation.approvedBy}
              </span>
            )}
            <button onClick={() => onAdd(review.player.id)} disabled={busy} className={link}>Add</button>
          </>
        )}
        {review.state === "INELIGIBLE" && (
          <>
            <span className={`${pill} text-red-700 bg-red-50 border-red-300`}>⚠ ineligible — needs review</span>
            {canOverride && !reviewing && (
              <button onClick={() => onStartReview("authorise")} disabled={busy} className={link}>Authorise</button>
            )}
            {!reviewing && (
              <button onClick={() => onStartReview("reject")} disabled={busy} className="text-red-600 text-xs font-semibold hover:underline">
                Reject
              </button>
            )}
          </>
        )}
      </div>
      {review.state === "INELIGIBLE" && (
        <p className="text-[11px] text-red-700 mt-0.5">
          {review.reason}
          {!canOverride && " An administrator with the Override rules permission can authorise this."}
        </p>
      )}
      {review.state === "INELIGIBLE" && reviewing === "authorise" && (
        <ReasonPrompt
          message={`Authorise ${name} for this team despite the rule above, and add them to the squad.`}
          confirmLabel="Authorise & add"
          tone="approve"
          required
          busy={busy}
          onConfirm={(reason) => onAuthorise(review.player.id, reason)}
          onCancel={onCancelReview}
        />
      )}
      {review.state === "INELIGIBLE" && reviewing === "reject" && (
        <ReasonPrompt
          message={`Reject ${name} from this team's nomination. They stay on the list, marked rejected.`}
          confirmLabel="Reject"
          tone="reject"
          required={false}
          busy={busy}
          onConfirm={onReject}
          onCancel={onCancelReview}
        />
      )}
      {blockedMessage && (
        <ReasonPrompt
          message={`${blockedMessage} You can approve this placement anyway.`}
          confirmLabel="Approve & add anyway"
          tone="approve"
          required
          busy={busy}
          onConfirm={onOverride}
          onCancel={onCancelReview}
        />
      )}
    </li>
  );
}
