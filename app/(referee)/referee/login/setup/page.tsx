"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Choose a password with a one-time set-up link from an administrator
// (/referee/login/setup?token=…). The link works once and expires after 7 days.
function SetupForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords don't match");
    setLoading(true);
    const res = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (res.status === 429) return setError("Too many attempts. Please wait a minute, then try again.");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "Couldn't set your password");
    router.push(data.role === "ADMIN" ? "/admin" : "/referee/games");
  };

  const input = "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";
  return (
    <form onSubmit={submit} className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
      <h1 className="font-black text-navy text-xl">Set your password</h1>
      {!token ? (
        <p className="text-sm text-red-700">This page needs the set-up link your administrator sent you.</p>
      ) : (
        <>
          <p className="text-sm text-muted">Choose a password of at least 10 characters. This link works once.</p>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-navy mb-1">New password</label>
            <input type="password" required minLength={10} autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} className={input} />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Confirm password</label>
            <input type="password" required minLength={10} autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} className={input} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-60">
            {loading ? "Setting password…" : "Set password & sign in"}
          </button>
        </>
      )}
    </form>
  );
}

export default function SetupPasswordPage() {
  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-brand font-black text-2xl">WAGGA FUTSAL</p>
          <p className="text-white/60 text-sm mt-1">Referee & Admin Portal</p>
        </div>
        <Suspense fallback={null}>
          <SetupForm />
        </Suspense>
      </div>
    </div>
  );
}
