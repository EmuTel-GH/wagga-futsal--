"use client";

import { useState } from "react";
import AddSessionForm from "./AddSessionForm";

type Session = {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  durationMins: number;
  capacityMax: number;
  priceCents: number;
  status: string;
  pitch?: { id: string; name: string } | null;
  _count: { bookings: number };
  bookings: { participantCount: number }[];
};

type Pitch = { id: string; name: string };

const STATUS_COLOURS: Record<string, string> = {
  OPEN: "bg-green-100 text-green-700",
  FULL: "bg-orange-100 text-orange-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function SessionsClient({ initialSessions, pitches }: { initialSessions: Session[]; pitches: Pitch[] }) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);

  const handleCreated = (s: Session) => setSessions((prev) => [s, ...prev]);

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch(`/api/admin/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const data = await res.json();
      setSessions((prev) => prev.map((s) => (s.id === id ? data : s)));
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete session "${title}"?`)) return;
    await fetch(`/api/admin/sessions/${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <>
      <div className="mb-6">
        <AddSessionForm onCreated={handleCreated} pitches={pitches} />
      </div>

      {sessions.length === 0 ? (
        <p className="text-muted text-sm">No sessions yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((s) => {
            const confirmedParticipants = s.bookings.reduce((sum, b) => sum + b.participantCount, 0);
            return (
              <div key={s.id} className="bg-white border border-border rounded-xl p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-bold text-navy text-base">{s.title}</h2>
                    {s.description && <p className="text-xs text-muted mt-0.5">{s.description}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_COLOURS[s.status] ?? "bg-gray-100"}`}>
                    {s.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-y-1 text-xs text-muted">
                  <span>📅 {new Date(s.scheduledAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}</span>
                  <span>⏱ {s.durationMins} min</span>
                  <span>👥 {confirmedParticipants} / {s.capacityMax} confirmed</span>
                  <span>💰 ${(s.priceCents / 100).toFixed(2)}</span>
                  <span>📋 {s._count.bookings} total bookings</span>
                  <span>📍 {s.pitch?.name ?? "No pitch assigned"}</span>
                </div>

                <div className="flex gap-2 mt-4">
                  {s.status === "OPEN" && (
                    <button onClick={() => handleStatusChange(s.id, "FULL")}
                      className="border border-border px-3 py-1.5 rounded text-sm hover:border-brand">
                      Close (Full)
                    </button>
                  )}
                  {s.status !== "CANCELLED" && (
                    <button onClick={() => handleStatusChange(s.id, "CANCELLED")}
                      className="border border-border px-3 py-1.5 rounded text-sm hover:border-red-500 hover:text-red-600">
                      Cancel
                    </button>
                  )}
                  {s.status !== "OPEN" && (
                    <button onClick={() => handleStatusChange(s.id, "OPEN")}
                      className="border border-border px-3 py-1.5 rounded text-sm hover:border-brand">
                      Reopen
                    </button>
                  )}
                  <button onClick={() => handleDelete(s.id, s.title)}
                    className="bg-red-500 text-white px-3 py-1.5 rounded text-sm hover:bg-red-600 ml-auto">
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
