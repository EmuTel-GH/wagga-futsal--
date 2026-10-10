import { test } from "node:test";
import assert from "node:assert/strict";
import { generateRoundRobin, scheduleFixtures } from "../lib/draw";
import { sydneyDateKey } from "../lib/breakDates";
import { planDrawRequests, type PlanFixture } from "../lib/drawRequests";

const ids = ["A", "B", "C", "D", "E", "F", "G"];
const slots = [0, 1, 2].map((i) => ({ pitchId: `p${i}`, dayOfWeek: 4, startTime: "16:00", durationMins: 30 }));
const base: PlanFixture[] = scheduleFixtures("c", generateRoundRobin(ids.map((id) => ({ id })), 2), slots, new Date("2026-10-15"), [{ name: "X", startDate: "2026-12-11", endDate: "2027-01-29" }])
  .fixtures.map((f, i) => ({ id: `f${i}`, round: f.round, homeTeamId: f.homeTeamId, awayTeamId: f.awayTeamId, scheduledAt: f.scheduledAt, status: "SCHEDULED" }));
const days = [...new Set(base.map((f) => sydneyDateKey(f.scheduledAt)))].sort();
const apply = (plan: ReturnType<typeof planDrawRequests>, fx = base) => fx.map((f) => ({ ...f, scheduledAt: plan.moves.find((m) => m.id === f.id)?.to ?? f.scheduledAt }));
const inWeek = (fx: PlanFixture[], d: string) => fx.filter((f) => sydneyDateKey(f.scheduledAt) === d);
const games = (fx: PlanFixture[]) => fx.map((f) => `${f.homeTeamId}>${f.awayTeamId}`).sort().join();

test("pins a match and a bye, by swapping whole rounds", () => {
  const plan = planDrawRequests(base, [
    { id: "m", kind: "MATCH_DATE", date: days[5], teamId: "A", opponentId: "B" },
    { id: "b", kind: "TEAM_BYE", date: days[2], teamId: "C", opponentId: null },
  ], ids);
  const after = apply(plan);
  assert.ok(plan.results.every((r) => r.ok));
  assert.ok(inWeek(after, days[5]).some((g) => [g.homeTeamId, g.awayTeamId].sort().join() === "A,B"));
  assert.ok(!inWeek(after, days[2]).some((g) => g.homeTeamId === "C" || g.awayTeamId === "C"));
  assert.equal(games(after), games(base));
  assert.ok(plan.roundMoves.length <= 4);
});

test("played rounds never move; requests on them are explained", () => {
  const played = base.map((f) => (f.round <= 2 ? { ...f, status: "COMPLETED" } : f));
  const plan = planDrawRequests(played, [{ id: "x", kind: "MATCH_DATE", date: days[0], teamId: "C", opponentId: "D" }], ids);
  assert.equal(plan.results[0].reason, "that week has already been played");
  assert.ok(!plan.moves.some((m) => played.find((f) => f.id === m.id)!.status === "COMPLETED"));
});

test("contradictory requests in one week are both reported", () => {
  const plan = planDrawRequests(base, [
    { id: "1", kind: "MATCH_DATE", date: days[4], teamId: "A", opponentId: "B" },
    { id: "2", kind: "TEAM_BYE", date: days[4], teamId: "A", opponentId: null },
  ], ids);
  assert.ok(plan.results.every((r) => !r.ok));
});

test("every team's bye pinned to a different week: all met (matching)", () => {
  const plan = planDrawRequests(base, ids.map((t, i) => ({ id: t, kind: "TEAM_BYE" as const, date: days[i], teamId: t, opponentId: null })), ids);
  const after = apply(plan);
  assert.ok(plan.results.every((r) => r.ok));
  assert.ok(ids.every((t, i) => !inWeek(after, days[i]).some((g) => g.homeTeamId === t || g.awayTeamId === t)));
});
