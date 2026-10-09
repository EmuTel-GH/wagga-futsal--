"use client";

import { useState } from "react";
import type { Competition, Venue } from "./CompetitionsClient";
import GenerateDrawForm, { describeDraw } from "@/components/admin/GenerateDrawForm";
import SplitPanel from "./SplitPanel";

const STATUS_COLOURS: Record<string, string> = {
  REGISTRATION: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-green-100 text-green-700",
  FINALS: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-gray-100 text-gray-600",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CompetitionCard({
  competition,
  venues,
  onUpdated,
  onDeleted,
}: {
  competition: Competition;
  venues: Venue[];
  onUpdated: (c: Competition) => void;
  onDeleted: (id: string) => void;
}) {
  const [finalsDate, setFinalsDate] = useState("");
  const [finalsPitch, setFinalsPitch] = useState(venues[0]?.pitches[0]?.id ?? "");
  const [finalsLoading, setFinalsLoading] = useState(false);
  const [slotForm, setSlotForm] = useState({
    pitchId: venues[0]?.pitches[0]?.id ?? "",
    dayOfWeek: "3",
    startTime: "18:00",
    durationMins: "40",
  });
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotError, setSlotError] = useState("");
  const [statusChanging, setStatusChanging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const handleStatusChange = async (status: string) => {
    setStatusChanging(true);
    const res = await fetch(`/api/admin/competitions/${competition.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setStatusChanging(false);
    if (res.ok) onUpdated(await res.json());
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${competition.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch(`/api/admin/competitions/${competition.id}`, { method: "DELETE" });
    setDeleting(false);
    onDeleted(competition.id);
  };

  const [drawMsg, setDrawMsg] = useState("");
  const [splitOpen, setSplitOpen] = useState(false);

  const handleStartFinals = async () => {
    if (!finalsDate || !finalsPitch) { setActionMsg("Enter finals date and pitch"); return; }
    setFinalsLoading(true);
    setActionMsg("");
    const res = await fetch("/api/admin/finals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitionId: competition.id, semifinalDate: finalsDate, pitchId: finalsPitch }),
    });
    const data = await res.json();
    setFinalsLoading(false);
    setActionMsg(res.ok ? `Finals created: ${data.created} fixtures` : data.error);
    if (res.ok) onUpdated({ ...competition, status: "FINALS" });
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSlotSaving(true);
    setSlotError("");
    const res = await fetch(`/api/admin/competitions/${competition.id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pitchId: slotForm.pitchId,
        dayOfWeek: Number(slotForm.dayOfWeek),
        startTime: slotForm.startTime,
        durationMins: Number(slotForm.durationMins),
      }),
    });
    const data = await res.json();
    setSlotSaving(false);
    if (!res.ok) { setSlotError(data.error ?? "Failed"); return; }
    onUpdated({ ...competition, timeSlots: [...competition.timeSlots, data] });
  };

  const handleDeleteSlot = async (slotId: string) => {
    await fetch(`/api/admin/competitions/${competition.id}/slots/${slotId}`, { method: "DELETE" });
    onUpdated({ ...competition, timeSlots: competition.timeSlots.filter((s) => s.id !== slotId) });
  };

  return (
    <div className="bg-white border border-border rounded-xl p-5 mb-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-navy">{competition.name}</h2>
          <p className="text-xs text-muted mt-0.5">
            {competition.season} · {competition.ageGroup} · {competition.gender}
            {competition.splitFrom && <> · split from {competition.splitFrom.name}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOURS[competition.status] ?? "bg-gray-100"}`}>
            {competition.status}
          </span>
          <select
            onChange={(e) => handleStatusChange(e.target.value)}
            value={competition.status}
            disabled={statusChanging}
            className="border border-border rounded px-2 py-1 text-xs focus:outline-none"
          >
            <option value="REGISTRATION">Registration</option>
            <option value="ACTIVE">Active</option>
            <option value="FINALS">Finals</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="bg-red-500 text-white px-3 py-1.5 rounded text-sm hover:bg-red-600 disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="text-xs text-muted mt-1">
        {competition.teams.length} teams · {competition._count.fixtures} fixtures
      </div>

      {/* Time Slots */}
      <div className="mt-4">
        <p className="text-xs font-bold text-navy uppercase tracking-wide mb-2">Time Slots</p>
        {competition.timeSlots.length === 0 ? (
          <p className="text-xs text-muted mb-2">No time slots yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-2">
            {competition.timeSlots.map((slot) => (
              <div key={slot.id} className="flex items-center gap-1.5 bg-gray-50 border border-border rounded-lg px-2.5 py-1 text-xs">
                <span className="font-semibold">{DAY_NAMES[slot.dayOfWeek]}</span>
                <span>{slot.startTime}</span>
                <span className="text-muted">({slot.durationMins}min)</span>
                <span className="text-muted">{slot.pitch.venue.name} – {slot.pitch.name}</span>
                <button
                  onClick={() => handleDeleteSlot(slot.id)}
                  className="ml-1 text-red-500 hover:text-red-700 font-bold leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddSlot} className="flex flex-wrap gap-2 items-end mt-2">
          <div>
            <label className="block text-xs text-muted mb-0.5">Pitch</label>
            <select
              value={slotForm.pitchId}
              onChange={(e) => setSlotForm((f) => ({ ...f, pitchId: e.target.value }))}
              className="border border-border rounded px-2 py-1.5 text-xs focus:outline-none"
            >
              {venues.flatMap((v) =>
                v.pitches.map((p) => (
                  <option key={p.id} value={p.id}>{v.name} – {p.name}</option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-0.5">Day</label>
            <select
              value={slotForm.dayOfWeek}
              onChange={(e) => setSlotForm((f) => ({ ...f, dayOfWeek: e.target.value }))}
              className="border border-border rounded px-2 py-1.5 text-xs focus:outline-none"
            >
              <option value="1">Mon</option>
              <option value="2">Tue</option>
              <option value="3">Wed</option>
              <option value="4">Thu</option>
              <option value="5">Fri</option>
              <option value="6">Sat</option>
              <option value="0">Sun</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-0.5">Start Time</label>
            <input
              type="time"
              value={slotForm.startTime}
              onChange={(e) => setSlotForm((f) => ({ ...f, startTime: e.target.value }))}
              className="border border-border rounded px-2 py-1.5 text-xs focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-0.5">Duration (min)</label>
            <input
              type="number"
              value={slotForm.durationMins}
              onChange={(e) => setSlotForm((f) => ({ ...f, durationMins: e.target.value }))}
              min={10}
              max={120}
              className="border border-border rounded px-2 py-1.5 text-xs w-20 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={slotSaving || venues.length === 0}
            className="bg-brand text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-brand-dark disabled:opacity-60"
          >
            {slotSaving ? "Adding…" : "Add Slot"}
          </button>
          {slotError && <p className="text-xs text-red-600">{slotError}</p>}
        </form>
      </div>

      {/* Draw */}
      {competition.status !== "COMPLETED" && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs font-bold text-navy uppercase tracking-wide mb-2">Generate draw</p>
          <GenerateDrawForm
            competition={competition}
            onGenerated={(d) => {
              setDrawMsg(describeDraw(d) + " Review and publish it on the Fixtures page.");
              onUpdated({ ...competition, _count: { fixtures: d.fixtures } });
            }}
          />
          {drawMsg && <p className="mt-2 text-xs text-green-800 bg-green-50 border border-green-200 rounded px-2 py-1.5">{drawMsg}</p>}
        </div>
      )}

      {/* Split */}
      {competition.status !== "COMPLETED" && competition.teams.length >= 4 && (
        <div className="mt-4 pt-4 border-t border-border">
          {!splitOpen ? (
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => setSplitOpen(true)}
                className="border border-brand text-brand px-3 py-1.5 rounded text-sm font-semibold hover:bg-brand/5">
                Split into divisions…
              </button>
              <p className="text-[11px] text-muted">
                e.g. after everyone has played each other once: top half and bottom half get new divisions and new fixtures.
              </p>
            </div>
          ) : (
            <SplitPanel competitionId={competition.id} onClose={() => setSplitOpen(false)} />
          )}
        </div>
      )}

      {/* Finals */}
      <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-bold text-navy uppercase tracking-wide mb-2">Start Finals</p>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="datetime-local"
              value={finalsDate}
              onChange={(e) => setFinalsDate(e.target.value)}
              className="border border-border rounded px-2 py-1.5 text-xs focus:outline-none"
            />
            <select
              value={finalsPitch}
              onChange={(e) => setFinalsPitch(e.target.value)}
              className="border border-border rounded px-2 py-1.5 text-xs focus:outline-none"
            >
              {venues.flatMap((v) =>
                v.pitches.map((p) => (
                  <option key={p.id} value={p.id}>{v.name} – {p.name}</option>
                ))
              )}
            </select>
            <button
              onClick={handleStartFinals}
              disabled={finalsLoading}
              className="bg-brand text-white px-3 py-1.5 rounded text-sm font-semibold hover:bg-brand-dark disabled:opacity-60"
            >
              {finalsLoading ? "Starting…" : "Start Finals"}
            </button>
          </div>
        </div>
      </div>

      {actionMsg && (
        <p className="mt-3 text-xs text-muted border-t border-border pt-2">{actionMsg}</p>
      )}
    </div>
  );
}
