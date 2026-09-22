"use client";

import { useState } from "react";
import AddRefereeForm from "./AddRefereeForm";

type Referee = {
  id: string;
  phone: string | null;
  bsb: string | null;
  accountNumber: string | null;
  accountName: string | null;
  firstName?: string | null;
  lastName?: string | null;
  // Null for referees imported from PlayFootball who don't have a login yet.
  user: { id: string; name: string; email: string; role: string } | null;
  _count: { fieldRefGames: number };
};

const refName = (r: Referee) =>
  r.user?.name ?? [r.firstName, r.lastName].filter(Boolean).join(" ") ?? "Unnamed referee";

function BankEditor({ referee, onSaved }: { referee: Referee; onSaved: (r: Referee) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    bsb: referee.bsb ?? "",
    accountNumber: referee.accountNumber ?? "",
    accountName: referee.accountName ?? "",
  });

  if (!open) {
    const hasBankDetails = referee.bsb && referee.accountNumber && referee.accountName;
    return (
      <button
        onClick={() => setOpen(true)}
        className={`text-xs px-2 py-1 rounded border transition-colors ${
          hasBankDetails
            ? "border-border text-muted hover:border-brand"
            : "border-yellow-400 text-yellow-700 bg-yellow-50 hover:bg-yellow-100"
        }`}
      >
        {hasBankDetails ? "Edit bank" : "⚠ Add bank details"}
      </button>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/admin/referees/${referee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const data = await res.json();
      onSaved({ ...referee, bsb: data.bsb, accountNumber: data.accountNumber, accountName: data.accountName });
      setOpen(false);
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="grid grid-cols-3 gap-2">
        <input
          placeholder="BSB (032-769)"
          value={form.bsb}
          onChange={(e) => setForm((f) => ({ ...f, bsb: e.target.value }))}
          className="border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <input
          placeholder="Account number"
          value={form.accountNumber}
          onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
          className="border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <input
          placeholder="Account name"
          value={form.accountName}
          onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
          className="border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>
      <div className="flex gap-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand text-white px-3 py-1 rounded text-xs font-semibold hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="border border-border px-2 py-1 rounded text-xs hover:border-brand"
        >
          Cancel
        </button>
      </div>
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
    if (!confirm(`Remove referee "${name}"? This will delete their login account.`)) return;
    await fetch(`/api/admin/referees/${id}`, { method: "DELETE" });
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
