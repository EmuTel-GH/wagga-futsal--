import { test } from "node:test";
import assert from "node:assert/strict";
import { validateNomination } from "../lib/nomination";

const ok = { teamName: "Thunder", competitionId: "c1", contactName: "Sam", contactEmail: "sam@example.com", contactPhone: "0400 123 456", kitShirt: "Blue", players: "Ann Lee\nBo Kim" };

test("a normal nomination passes", () => assert.equal(validateNomination(ok), null));
test("required fields, types and lengths are enforced", () => {
  assert.match(validateNomination({ ...ok, contactName: "" })!, /required/);
  assert.match(validateNomination({ ...ok, teamName: "x".repeat(61) })!, /too long/);
  assert.match(validateNomination({ ...ok, kitShirt: { evil: true } })!, /invalid/);
  assert.match(validateNomination({ ...ok, players: "x".repeat(2001) })!, /too long/);
  assert.match(validateNomination({ ...ok, players: "y".repeat(61) })!, /60 characters/);
});
test("email and phone must look real", () => {
  for (const e of ["nope", "a@b", "a b@c.com", "x@y.c"]) assert.match(validateNomination({ ...ok, contactEmail: e })!, /email/);
  assert.match(validateNomination({ ...ok, contactPhone: "call me" })!, /phone/);
  assert.equal(validateNomination({ ...ok, contactPhone: "" }), null);
});
