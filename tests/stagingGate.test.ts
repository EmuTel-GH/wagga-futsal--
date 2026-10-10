import { test } from "node:test";
import assert from "node:assert/strict";
import { gateDecision, isOpenPath, needsSession, type GateSession } from "../lib/stagingGate";

const now = new Date("2026-10-10T00:00:00Z");
const later = new Date("2026-11-01T00:00:00Z");
const admin: GateSession = { expiresAt: later, user: { role: "ADMIN", active: true } };
const referee: GateSession = { expiresAt: later, user: { role: "REFEREE", active: true } };
const expired: GateSession = { expiresAt: new Date("2026-10-01T00:00:00Z"), user: { role: "ADMIN", active: true } };
const inactive: GateSession = { expiresAt: later, user: { role: "ADMIN", active: false } };
const allSessions: GateSession[] = [null, admin, referee, expired];
const notAdmin: GateSession[] = [null, referee, expired, inactive];
const paths = ["/", "/competition", "/admin", "/admin/teams", "/teams/abc", "/api/admin/teams", "/api/teams/abc/calendar", "/api/public/v1/competitions", "/referee/login", "/api/health", "/_next/static/chunks/a.js", "/logo.png"];

test("production: every path passes untouched, no noindex, sessions irrelevant", () => {
  for (const env of [undefined, "", "production"] as (string | undefined)[]) {
    for (const pathname of paths) {
      for (const session of allSessions) {
        assert.deepEqual(gateDecision({ env, pathname, session, now }), { action: "next", noindex: false }, `${env}:${pathname}`);
      }
      assert.equal(needsSession(env, pathname), false);
    }
  }
});

test("staging: open paths pass for anyone, with noindex", () => {
  for (const pathname of ["/referee/login", "/api/auth/login", "/api/auth/logout", "/api/auth/set-password", "/api/health", "/_next/static/chunks/main.js", "/_next/image", "/favicon.ico", "/logo.png", "/images/hero.webp"]) {
    assert.ok(isOpenPath(pathname), pathname);
    assert.deepEqual(gateDecision({ env: "staging", pathname, session: null, now }), { action: "next", noindex: true }, pathname);
  }
});

test("staging: pages redirect to sign-in, APIs get 401, unless an active admin session", () => {
  for (const session of notAdmin) {
    assert.deepEqual(gateDecision({ env: "staging", pathname: "/", session, now }), { action: "redirect", location: "/referee/login", noindex: true });
    assert.deepEqual(gateDecision({ env: "staging", pathname: "/admin/teams", session, now }).action, "redirect");
    assert.deepEqual(gateDecision({ env: "staging", pathname: "/api/admin/teams", session, now }), { action: "unauthorized", noindex: true });
    assert.equal(gateDecision({ env: "staging", pathname: "/api/teams/x/calendar", session, now }).action, "unauthorized", "public APIs too");
  }
  for (const pathname of paths) {
    assert.deepEqual(gateDecision({ env: "staging", pathname, session: admin, now }), { action: "next", noindex: true }, pathname);
  }
});

test("staging: look-alike paths are not open", () => {
  for (const pathname of ["/api/healthz", "/api/authx", "/referee/loginx", "/api/admin/x.png", "/admin/logo.png.html"]) {
    assert.equal(isOpenPath(pathname), false, pathname);
    assert.notEqual(gateDecision({ env: "staging", pathname, session: null, now }).action, "next", pathname);
  }
  assert.ok(needsSession("staging", "/admin"));
  assert.equal(needsSession("staging", "/api/health"), false);
});
