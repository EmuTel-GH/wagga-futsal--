/**
 * Staging gate (APP_ENV=staging only): the staging site holds a copy of real
 * data, so every request needs a signed-in ADMIN, apart from what's needed to
 * sign in. Pure decision logic, used by proxy.ts and unit-tested; the session
 * lookup itself (token → session → user) happens in proxy.ts.
 *
 * Production (any APP_ENV other than "staging") is never gated and gets no
 * extra headers.
 */
export type GateSession = { expiresAt: Date; user: { role: string; active: boolean } } | null;

export type GateDecision =
  | { action: "next"; noindex: boolean }
  | { action: "redirect"; location: string; noindex: true }
  | { action: "unauthorized"; noindex: true };

export const SIGN_IN_PATH = "/referee/login";

// Static files (Next's own assets, and anything in /public with an extension).
// /_next/image takes its parameters in the query string, so match it exactly.
const STATIC = /^\/_next\/static\/|^\/_next\/image$|^\/favicon\.ico$|^\/(?!api\/)[^?]*\.(png|jpe?g|gif|webp|svg|ico|css|js|map|txt|woff2?|ttf|webmanifest)$/i;

/** Paths anyone may reach on staging: signing in, health checks, static files. */
export function isOpenPath(pathname: string) {
  return (
    pathname === SIGN_IN_PATH ||
    pathname.startsWith(`${SIGN_IN_PATH}/`) ||
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/health" ||
    STATIC.test(pathname)
  );
}

/** A session counts only if it exists, hasn't expired, and is an active ADMIN's. */
export function isAdminSession(session: GateSession, now = new Date()) {
  return !!session && session.expiresAt > now && session.user.active && session.user.role === "ADMIN";
}

export function gateDecision(opts: { env: string | undefined; pathname: string; session: GateSession; now?: Date }): GateDecision {
  if (opts.env !== "staging") return { action: "next", noindex: false };
  if (isOpenPath(opts.pathname) || isAdminSession(opts.session, opts.now)) return { action: "next", noindex: true };
  if (opts.pathname === "/api" || opts.pathname.startsWith("/api/")) return { action: "unauthorized", noindex: true };
  return { action: "redirect", location: SIGN_IN_PATH, noindex: true };
}

/** Does this path need the session looked up? (Saves a DB query on open paths.) */
export function needsSession(env: string | undefined, pathname: string) {
  return env === "staging" && !isOpenPath(pathname);
}
