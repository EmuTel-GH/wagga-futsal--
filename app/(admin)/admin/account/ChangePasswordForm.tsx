"use client";

import { useState } from "react";

export default function ChangePasswordForm() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDone(false);
    if (form.newPassword !== form.confirm) return setError("New passwords don't match");
    setSaving(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Failed");
    setForm({ currentPassword: "", newPassword: "", confirm: "" });
    setDone(true);
  };

  const input = "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <form onSubmit={submit} className="bg-white border border-border rounded-xl p-5 space-y-3">
      <h2 className="font-bold text-navy">Change password</h2>
      <input type="password" autoComplete="current-password" placeholder="Current password" required
        value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} className={input} />
      <input type="password" autoComplete="new-password" placeholder="New password (10+ characters)" required minLength={10}
        value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} className={input} />
      <input type="password" autoComplete="new-password" placeholder="Confirm new password" required
        value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} className={input} />
      <button type="submit" disabled={saving}
        className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-60">
        {saving ? "Saving…" : "Change password"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700">Password changed. Your other sessions have been signed out.</p>}
    </form>
  );
}
