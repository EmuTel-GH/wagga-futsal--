"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefereeLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phase, setPhase] = useState<"login" | "setPassword">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (phase === "setPassword") {
      if (password !== confirm) {
        setError("Passwords don't match");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(data.error ?? "Could not set password");
        return;
      }
      router.push(data.role === "ADMIN" ? "/admin" : "/referee/games");
      return;
    }

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Login failed");
      return;
    }

    // First sign-in for an imported account: create a password now.
    if (data.mustSetPassword) {
      setPhase("setPassword");
      setPassword("");
      setConfirm("");
      return;
    }

    router.push(data.role === "ADMIN" ? "/admin" : "/referee/games");
  };

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-brand font-black text-2xl">WAGGA FUTSAL</p>
          <p className="text-white/60 text-sm mt-1">Referee & Admin Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
          <h1 className="font-black text-navy text-xl">
            {phase === "setPassword" ? "Create your password" : "Sign In"}
          </h1>

          {phase === "setPassword" && (
            <p className="text-sm text-muted">
              First sign-in for <span className="font-semibold text-navy">{email}</span> — choose a
            password (at least 8 characters).
            </p>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded">
              {error}
            </div>
          )}

          {phase === "login" && (
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Email or username</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="you@example.com or firstname.lastname"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-navy mb-1">
              {phase === "setPassword" ? "New password" : "Password"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={phase === "setPassword"}
              minLength={phase === "setPassword" ? 8 : undefined}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            {phase === "login" && (
              <p className="text-xs text-muted mt-1">
                First time signing in? Enter your username and leave the password blank — you&apos;ll
                set one next.
              </p>
            )}
          </div>

          {phase === "setPassword" && (
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading
              ? phase === "setPassword" ? "Setting password…" : "Signing in…"
              : phase === "setPassword" ? "Set password & sign in" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
