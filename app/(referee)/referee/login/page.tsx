"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefereeLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    // Too many attempts from this connection: the proxy answers 429 (maybe not JSON).
    if (res.status === 429) {
      setError("Too many sign-in attempts. Please wait a minute, then try again.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Login failed");
      return;
    }
    router.push(data.role === "ADMIN" ? "/admin" : "/referee/games");
  };

  const input = "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";
  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-brand font-black text-2xl">WAGGA FUTSAL</p>
          <p className="text-white/60 text-sm mt-1">Referee & Admin Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
          <h1 className="font-black text-navy text-xl">Sign In</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-navy mb-1">Email or username</label>
            <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} required
              autoCapitalize="none" autoCorrect="off" autoComplete="username"
              className={input} placeholder="you@example.com or firstname.lastname" />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              autoComplete="current-password" className={input} />
            <p className="text-xs text-muted mt-1">
              First time, or forgotten your password? Ask an administrator for a set-up link.
            </p>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-60">
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
