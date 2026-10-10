import { test } from "node:test";
import assert from "node:assert/strict";
import { canOpenScorer, fixtureAccess, validateEvent } from "../lib/fixtureAccess";

const fx = (status: string) => ({ status, fieldRefereeId: "refA", scorerId: "refB" });
const admin = { role: "ADMIN", refereeId: null };
const fieldRef = { role: "REFEREE", refereeId: "refA" };
const scorer = { role: "REFEREE", refereeId: "refB" };
const otherRef = { role: "REFEREE", refereeId: "refC" };
const noProfile = { role: "REFEREE", refereeId: null };

test("only the assigned field referee or scorer, or an admin, can score a live game", () => {
  for (const c of [admin, fieldRef, scorer]) assert.ok(fixtureAccess(c, fx("LIVE")).ok);
  for (const c of [otherRef, noProfile]) assert.deepEqual(fixtureAccess(c, fx("LIVE")), { ok: false, status: 403, error: "You're not the referee or scorer for this game" });
  assert.ok(fixtureAccess(fieldRef, fx("SCHEDULED")).ok, "assigned ref can start the game");
});

test("finished games are admin-only; drafts are nobody's", () => {
  for (const s of ["COMPLETED", "FORFEITED_HOME", "FORFEITED_AWAY", "ABANDONED"]) {
    assert.equal(fixtureAccess(fieldRef, fx(s)).ok, false, s);
    assert.ok(fixtureAccess(admin, fx(s)).ok, s);
  }
  assert.equal(fixtureAccess(admin, fx("DRAFT")).ok, false);
});

test("scoring console opens only for the assigned officials or an admin", () => {
  assert.ok(canOpenScorer(fieldRef, fx("SCHEDULED")) && canOpenScorer(scorer, fx("SCHEDULED")) && canOpenScorer(admin, fx("SCHEDULED")));
  assert.equal(canOpenScorer(otherRef, fx("SCHEDULED")), false);
  assert.equal(canOpenScorer(noProfile, { status: "LIVE", fieldRefereeId: null, scorerId: null }), false, "unassigned game, ref with no profile");
});

test("events must be for one of the two teams, with a known type and sane timing", () => {
  const game = { homeTeamId: "H", awayTeamId: "A" };
  assert.equal(validateEvent({ teamId: "H", type: "GOAL", minute: 12, half: 1 }, game), null);
  assert.equal(validateEvent({ teamId: "A", type: "FOUL", minute: "0", half: "2" }, game), null);
  assert.match(validateEvent({ teamId: "X", type: "GOAL", minute: 1, half: 1 }, game)!, /isn't playing/);
  assert.match(validateEvent({ teamId: "H", type: "PENALTY", minute: 1, half: 1 }, game)!, /type/);
  assert.match(validateEvent({ teamId: "H", type: "GOAL", minute: 99, half: 1 }, game)!, /Minute/);
  assert.match(validateEvent({ teamId: "H", type: "GOAL", minute: 5, half: 3 }, game)!, /Half/);
});
