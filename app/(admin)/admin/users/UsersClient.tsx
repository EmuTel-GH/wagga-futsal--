"use client";

import { useState } from "react";
import { PERMISSIONS, ROLES, MIN_ADMIN_SET_PASSWORD } from "@/lib/users";

type Role = "ADMIN" | "REFEREE";
type Permission = (typeof PERMISSIONS)[number]["key"];
type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
  active: boolean;
  mustSetPassword: boolean;
  lastLoginAt: Date | string | null;
  createdAt: Date | string;
  referee?: { id: string } | null;
};

const fmt = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Sydney" }) : "Never";

const input = "border border-border rounded px-2 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand";
const btn = "bg-brand text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-brand-dark disabled:opacity-60";
const btnGhost = "border border-border px-3 py-1.5 rounded text-xs hover:border-brand disabled:opacity-60";

function PermissionPicker({ role, value, onChange }: { role: Role; value: Permission[]; onChange: (p: Permission[]) => void }) {
  if (role !== "ADMIN") return <p className="text-xs text-muted">Referees use the scoring portal only.</p>;
  return (
    <div className="space-y-1">
      {PERMISSIONS.map((p) => (
        <label key={p.key} className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={value.includes(p.key)}
            onChange={(e) => onChange(e.target.checked ? [...value, p.key] : value.filter((x) => x !== p.key))}
            className="mt-0.5"
          />
          <span>
            <span className="font-semibold text-navy">{p.label}</span> <span className="text-muted">— {p.description}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function AddUserForm({ onCreated }: { onCreated: (u: User) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "ADMIN" as Role, permissions: [] as Permission[], password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Failed");
    onCreated(data);
    setForm({ name: "", email: "", role: "ADMIN", permissions: [], password: "" });
    setOpen(false);
  };

  if (!open) {
    return <button onClick={() => setOpen(true)} className={btn}>+ Add user</button>;
  }

  return (
    <form onSubmit={submit} className="bg-white border border-border rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-semibold text-muted mb-0.5">Name</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-muted mb-0.5">Email or username (sign-in)</label>
          <input required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-muted mb-0.5">Role</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className={input}>
            {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
      </div>
      <PermissionPicker role={form.role} value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} />
      <div>
        <label className="block text-[10px] font-semibold text-muted mb-0.5">
          Temporary password (optional, min {MIN_ADMIN_SET_PASSWORD} characters)
        </label>
        <input
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className={`${input} sm:w-72`}
        />
        <p className="text-[11px] text-muted mt-1">
          Leave blank and they&apos;ll create their own password the first time they sign in. Anyone who knows the
          username can do that first sign-in, so for administrators it&apos;s safer to set a temporary password and
          send it to them privately.
        </p>
      </div>
      <div className="flex gap-2 items-center">
        <button type="submit" disabled={saving} className={btn}>{saving ? "Creating…" : "Create user"}</button>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Cancel</button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </form>
  );
}

function UserRow({ user, isSelf, onUpdated, onDeleted }: { user: User; isSelf: boolean; onUpdated: (u: User) => void; onDeleted: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: user.name, email: user.email, role: user.role, permissions: user.permissions });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const patch = async (body: Record<string, unknown>, done?: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Failed");
    onUpdated({ ...user, ...data });
    setForm({ name: data.name, email: data.email, role: data.role, permissions: data.permissions });
    if (done) setNotice(done);
  };

  const remove = async () => {
    if (!confirm(`Delete ${user.name}'s login permanently? Their audit history is kept.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Failed");
    onDeleted(user.id);
  };

  const status = !user.active
    ? { label: "Deactivated", cls: "bg-gray-100 border-gray-300 text-gray-600" }
    : user.mustSetPassword
      ? { label: "Awaiting first sign-in", cls: "bg-amber-50 border-amber-300 text-amber-700" }
      : { label: "Active", cls: "bg-green-50 border-green-300 text-green-700" };

  return (
    <div className={`border-b border-border last:border-b-0 ${user.active ? "" : "opacity-70"}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <div className="min-w-0">
          <p className="text-sm">
            <span className="font-semibold text-navy">{user.name}</span>
            {isSelf && <span className="ml-1 text-xs text-muted">(you)</span>}
            <span className="ml-2 text-xs text-muted">{user.email}</span>
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            <span className="text-[10px] font-bold bg-navy/10 text-navy px-1.5 py-0.5 rounded-full">
              {user.role === "ADMIN" ? "Administrator" : "Referee"}
            </span>
            {user.permissions.map((p) => (
              <span key={p} className="text-[10px] font-bold bg-brand/10 text-brand px-1.5 py-0.5 rounded-full">
                {PERMISSIONS.find((x) => x.key === p)?.label ?? p}
              </span>
            ))}
            <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-muted">Last sign-in</p>
          <p className="text-xs text-navy">{fmt(user.lastLoginAt)}</p>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-3 bg-gray-50 border-t border-border space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-muted mb-0.5">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted mb-0.5">Email or username</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted mb-0.5">Role</label>
              <select
                value={form.role}
                disabled={isSelf}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                className={input}
              >
                {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <PermissionPicker role={form.role} value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} />
          <button disabled={busy} onClick={() => patch(form, "Saved.")} className={btn}>Save changes</button>

          <div className="border-t border-border pt-3">
            <p className="text-xs font-bold text-navy uppercase tracking-wide mb-2">Password &amp; access</p>
            <div className="flex flex-wrap gap-2 items-center">
              {!isSelf && (
                <>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder={`New temporary password (${MIN_ADMIN_SET_PASSWORD}+ chars)`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${input} sm:w-64`}
                  />
                  <button
                    disabled={busy || password.length < MIN_ADMIN_SET_PASSWORD}
                    onClick={() => patch({ password }, "Password reset — they've been signed out everywhere.").then(() => setPassword(""))}
                    className={btnGhost}
                  >
                    Set password
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => confirm(`Clear ${user.name}'s password? They'll create a new one the next time they sign in.`) && patch({ requirePasswordSetup: true }, "Password cleared.")}
                    className={btnGhost}
                  >
                    Clear password (set at next sign-in)
                  </button>
                  <button disabled={busy} onClick={() => patch({ revokeSessions: true }, "Signed out everywhere.")} className={btnGhost}>
                    Sign out everywhere
                  </button>
                </>
              )}
              {isSelf && <p className="text-xs text-muted">Change your own password under My account (your name, bottom left).</p>}
            </div>
          </div>

          {!isSelf && (
            <div className="border-t border-border pt-3 flex flex-wrap gap-2 items-center">
              {user.active ? (
                <button
                  disabled={busy}
                  onClick={() => confirm(`Deactivate ${user.name}? They're signed out immediately and can't sign in until reactivated.`) && patch({ active: false }, "Deactivated.")}
                  className="border border-amber-400 text-amber-700 px-3 py-1.5 rounded text-xs font-semibold hover:bg-amber-50 disabled:opacity-60"
                >
                  Deactivate
                </button>
              ) : (
                <button disabled={busy} onClick={() => patch({ active: true }, "Reactivated.")} className={btnGhost}>
                  Reactivate
                </button>
              )}
              {!user.referee && (
                <button disabled={busy} onClick={remove} className="bg-red-500 text-white px-3 py-1.5 rounded text-xs hover:bg-red-600 disabled:opacity-60">
                  Delete
                </button>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
          {notice && <p className="text-xs text-green-700">{notice}</p>}
          <p className="text-[11px] text-muted">Created {fmt(user.createdAt)}</p>
        </div>
      )}
    </div>
  );
}

export default function UsersClient({ initialUsers, currentUserId }: { initialUsers: User[]; currentUserId: string }) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [filter, setFilter] = useState<"ALL" | Role | "INACTIVE">("ALL");
  const [q, setQ] = useState("");

  const shown = users.filter((u) => {
    if (filter === "INACTIVE" ? u.active : filter !== "ALL" && (u.role !== filter || !u.active)) return false;
    const s = q.trim().toLowerCase();
    return !s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
  });

  return (
    <>
      <div className="mb-6">
        <AddUserForm onCreated={(u) => setUsers((prev) => [...prev, u])} />
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        {(["ALL", "ADMIN", "REFEREE", "INACTIVE"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${filter === f ? "bg-navy text-white border-navy" : "bg-white border-border text-navy hover:border-brand"}`}
          >
            {{ ALL: "All", ADMIN: "Administrators", REFEREE: "Referees", INACTIVE: "Deactivated" }[f]}
          </button>
        ))}
        <input placeholder="Search name or login…" value={q} onChange={(e) => setQ(e.target.value)} className={`${input} sm:w-56 ml-auto`} />
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {shown.length === 0 ? (
          <p className="text-center text-muted py-8 text-sm">No users match.</p>
        ) : (
          shown.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              isSelf={u.id === currentUserId}
              onUpdated={(nu) => setUsers((prev) => prev.map((x) => (x.id === nu.id ? { ...x, ...nu } : x)))}
              onDeleted={(id) => setUsers((prev) => prev.filter((x) => x.id !== id))}
            />
          ))
        )}
      </div>
    </>
  );
}
