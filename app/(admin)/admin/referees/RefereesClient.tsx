"use client";

import { useState } from "react";
import AddRefereeForm from "./AddRefereeForm";

type Referee = {
  id: string;
  phone: string | null;
  bsb: string | null;
  accountNumber: string | null;
  accountName: string | null;
  // Masked values only (BSB 062-•••, account ••••5678) — see lib/bankDetails.
  hasBankDetails?: boolean;
  firstName?: string | null;
  lastName?: string | null;
  // Null for referees imported from PlayFootball who don't have a login yet.
  user: { id: string; name: string; email: string; role: string } | null;
  _count: { fieldRefGames: number };
};

const refName = (r: Referee) =>
  r.user?.name ?? [r.firstName, r.lastName].filter(Boolean).join(" ") ?? "Unnamed referee";

// Bank details are write-only here: the page only ever receives them masked
// (BSB 062-•••, account ••••5678). To change them, type the new details in.
function BankEditor({ referee, onSaved }: { referee: Referee; onSaved: (r: Referee) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ bsb: "", accountNumber: "", accountName: "" });

  if (!open) {
    return (
      <button
        onClick={() => { setForm({ bsb: "", accountNumber: "", accountName: "" }); setError(""); setOpen(true); }}
        className={`text-xs px-2 py-1 rounded border transition-colors ${
          referee.hasBankDetails
            ? "border-border text-muted hover:border-brand"
            : "border-yellow-400 text-yellow-700 bg-yellow-50 hover:bg-yellow-100"
        }`}
      >
        {referee.hasBankDetails ? "Change bank details" : "⚠ Add bank details"}
      </button>
    );
  }

  const save = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/referees/${referee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Couldn't save");
    onSaved({ ...referee, bsb: data.bsb, accountNumber: data.accountNumber, accountName: data.accountName, hasBankDetails: data.hasBankDetails });
    setOpen(false);
  };

  const input = "border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand";
  return (
    <div className="flex flex-col gap-2 py-1">
      {referee.hasBankDetails && (
        <p className="text-[11px] text-muted">On file: {referee.bsb} · {referee.accountNumber}. Enter the new details to replace them.</p>
      )}
      <div className="grid grid-cols-3 gap-2">
        <input placeholder="BSB (032-769)" inputMode="numeric" autoComplete="off" value={form.bsb}
          onChange={(e) => setForm((f) => ({ ...f, bsb: e.target.value }))} className={input} />
        <input placeholder="Account number" inputMode="numeric" autoComplete="off" value={form.accountNumber}
          onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} className={input} />
        <input placeholder="Account name" autoComplete="off" value={form.accountName}
          onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} className={input} />
      </div>
      <div className="flex gap-1 items-center flex-wrap">
        <button onClick={() => save(form)} disabled={saving}
          className="bg-brand text-white px-3 py-1 rounded text-xs font-semibold hover:bg-brand-dark disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setOpen(false)} className="border border-border px-2 py-1 rounded text-xs hover:border-brand">
          Cancel
        </button>
        {referee.hasBankDetails && (
          <button onClick={() => confirm("Remove this referee's bank details?") && save({ clear: true })} disabled={saving}
            className="text-xs text-red-600 hover:underline ml-2">Remove</button>
        )}
        {error && <span className="text-xs text-red-600 ml-2">{error}</span>}
      </div>
      <p className="text-[10px] text-muted">🔒 Stored encrypted. Shown masked; only used to build the payment (ABA) file.</p>
    </div>
  );
}

export default function RefereesClient({ initialReferees }: { initialReferees: Referee[] }) {
  const [referees, setReferees] = useState<Referee[]>(initialReferees);

  const handleCreated = (r: Referee) => setReferees((prev) => [...prev, r]);

  const handleBankSaved = (updated: Referee) => {
    setReferees((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove referee "${name}"? Referees with games are kept and their login deactivated instead.`)) return;
    const res = await fetch(`/api/admin/referees/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error ?? "Couldn't remove the referee");
    if (data.deactivated) return alert(`${name} has game history, so they've been kept and their login deactivated.`);
    setReferees((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <>
      <div className="mb-6">
        <AddRefereeForm onCreated={handleCreated} />
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy text-white">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Name</th>
              <th className="px-4 py-3 text-left font-semibold">Email</th>
              <th className="px-4 py-3 text-left font-semibold">Phone</th>
              <th className="px-4 py-3 text-left font-semibold">Games</th>
              <th className="px-4 py-3 text-left font-semibold">Bank Details</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {referees.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-muted py-8">No referees yet.</td>
              </tr>
            ) : (
              referees.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-semibold">{refName(r)}</td>
                  <td className="px-4 py-2.5 text-muted">
                    {r.user?.email ?? <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">no login yet</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{r.phone ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted">{r._count.fieldRefGames}</td>
                  <td className="px-4 py-2.5">
                    {r.bsb && r.accountNumber ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted">{r.bsb} · {r.accountNumber}</span>
                        {r.accountName && <span className="text-xs text-muted">{r.accountName}</span>}
                        <BankEditor referee={r} onSaved={handleBankSaved} />
                      </div>
                    ) : (
                      <BankEditor referee={r} onSaved={handleBankSaved} />
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleDelete(r.id, refName(r))}
                      className="bg-red-500 text-white px-3 py-1.5 rounded text-sm hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
