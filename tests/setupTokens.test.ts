import { test } from "node:test";
import assert from "node:assert/strict";
import { hashSetupToken, looksLikeSetupToken, newSetupToken, setupLinkExpiry, setupUrl, SETUP_PATH } from "../lib/setupTokens";

test("tokens are 256-bit, URL-safe and unique; only the hash is stored", () => {
  const a = newSetupToken(), b = newSetupToken();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
  assert.equal(hashSetupToken(a), hashSetupToken(a));
  assert.notEqual(hashSetupToken(a), a);
  assert.match(hashSetupToken(a), /^[0-9a-f]{64}$/);
});

test("links expire after 7 days and point at the setup page", () => {
  const from = new Date("2026-10-11T00:00:00Z");
  assert.equal(setupLinkExpiry(from).toISOString(), "2026-10-18T00:00:00.000Z");
  assert.equal(setupUrl("https://example.test/", "abc"), `https://example.test${SETUP_PATH}?token=abc`);
  assert.ok(SETUP_PATH.startsWith("/referee/login/"), "under the sign-in path, so the staging gate lets it through");
});

test("malformed tokens are rejected before any lookup", () => {
  for (const t of ["", "short", undefined, null, 123, "x".repeat(43) + "!", "a".repeat(44)]) assert.equal(looksLikeSetupToken(t), false);
  assert.ok(looksLikeSetupToken(newSetupToken()));
});
