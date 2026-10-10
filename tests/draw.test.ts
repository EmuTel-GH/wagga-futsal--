import { test } from "node:test";
import assert from "node:assert/strict";
import { generateRoundRobin, scheduleFixtures } from "../lib/draw";
import { breakFor, planBreakShifts, sydneyDateKey } from "../lib/breakDates";

const teams = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `T${i}` }));
const wed = [0, 1, 2].map((i) => ({ pitchId: `p${i}`, dayOfWeek: 3, startTime: "17:00", durationMins: 40 }));
const xmas = [{ name: "Christmas", startDate: "2026-12-19", endDate: "2027-01-12" }];

test("round-robin: everyone plays everyone once per cycle", () => {
  const rounds = generateRoundRobin(teams(6), 1);
  assert.equal(rounds.length, 5);
  const pairs = new Set(rounds.flat().map(([h, a]) => [h, a].sort().join()));
  assert.equal(pairs.size, 15);
});

test("odd teams: one bye per round, n rounds per cycle", () => {
  const rounds = generateRoundRobin(teams(7), 1);
  assert.equal(rounds.length, 7);
  assert.ok(rounds.every((r) => r.length === 3));
});

test("breaks: no game lands in a break; rounds stay whole and in order", () => {
  const { fixtures, skipped } = scheduleFixtures("c", generateRoundRobin(teams(7), 2), wed, new Date("2026-10-14"), xmas);
  assert.ok(fixtures.every((f) => !breakFor(f.scheduledAt, xmas)));
  assert.equal(skipped.length, 3);
  const byRound = new Map<number, Set<string>>();
  fixtures.forEach((f) => byRound.set(f.round, (byRound.get(f.round) ?? new Set()).add(sydneyDateKey(f.scheduledAt))));
  assert.ok([...byRound.values()].every((d) => d.size === 1));
});

test("kick-off stays 5pm Sydney across daylight saving", () => {
  const { fixtures } = scheduleFixtures("c", generateRoundRobin(teams(6), 2), wed, new Date("2026-09-30"), []);
  const t = new Intl.DateTimeFormat("en-GB", { timeZone: "Australia/Sydney", hour: "2-digit", minute: "2-digit" });
  assert.ok(fixtures.every((f) => t.format(f.scheduledAt) === "17:00"));
});

test("end date stops the draw and reports it", () => {
  const r = scheduleFixtures("c", generateRoundRobin(teams(6), 3), wed, new Date("2026-10-14"), xmas, { endDate: "2026-11-30" });
  assert.ok(r.stoppedAtEndDate);
  assert.ok(r.fixtures.every((f) => sydneyDateKey(f.scheduledAt) <= "2026-11-30"));
});

test("moving an existing draw out of breaks = generating with the breaks", () => {
  const rounds = generateRoundRobin(teams(7), 2);
  const plain = scheduleFixtures("c", rounds, wed, new Date("2026-10-14"), []).fixtures;
  const withBreaks = scheduleFixtures("c", rounds, wed, new Date("2026-10-14"), xmas).fixtures;
  const { moved } = planBreakShifts(plain.map((f, i) => ({ id: `f${i}`, round: f.round, phase: "REGULAR", scheduledAt: f.scheduledAt })), xmas);
  const after = plain.map((f, i) => moved.find((m) => m.id === `f${i}`)?.to ?? f.scheduledAt);
  assert.deepEqual(after.map(sydneyDateKey), withBreaks.map((f) => sydneyDateKey(f.scheduledAt)));
});
