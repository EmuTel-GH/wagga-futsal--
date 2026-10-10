import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { defaultAssignment, distributeSlots, validateSplit } from "../lib/split";
import { checkEligibility } from "../lib/eligibility";
import { registrationState } from "../lib/registrationStatus";
import { buildIcs } from "../lib/ics";

test("split: ladder dealt top-down, slots shared without overlap", () => {
  const a = defaultAssignment(["a", "b", "c", "d", "e", "f", "g"], 2);
  assert.deepEqual(["a", "b", "c", "d", "e", "f", "g"].map((t) => a[t]), [0, 0, 0, 0, 1, 1, 1]);
  const slot = (id: string, pitchId: string, startTime = "16:00") => ({ id, dayOfWeek: 4, startTime, pitchId, durationMins: 30 });
  const { perDivision, clash } = distributeSlots([slot("1", "p1"), slot("2", "p2"), slot("3", "p1", "16:45")], 2);
  assert.equal(clash, false);
  assert.deepEqual(perDivision.map((d) => d.map((s) => s.id)), [["1", "3"], ["2"]]);
  assert.equal(validateSplit([{ name: "A", teamIds: ["a", "b"] }, { name: "a", teamIds: ["c", "d"] }], ["a", "b", "c", "d"]).length, 1);
});

test("eligibility: play-up needs approval, override clears any rule", () => {
  const p = { dateOfBirth: new Date("2016-03-24"), gender: "MALE" as const, registeredAgeGroup: "U10" as const };
  const comp = { ageGroup: "U12" as const, gender: "MIXED" as const };
  const r = checkEligibility({ ...p, competition: comp });
  assert.equal(r.eligible, false);
  assert.equal(!r.eligible && r.requires, "PLAY_UP");
  assert.equal(checkEligibility({ ...p, competition: comp, dispensation: { type: "PLAY_UP" } }).eligible, true);
  assert.equal(checkEligibility({ ...p, competition: { ageGroup: "U12", gender: "FEMALE" }, dispensation: { type: "OVERRIDE" } }).eligible, true);
});

test("PlayFootball statuses from the real export", () => {
  assert.equal(registrationState("Approved", "PaidInFull"), "REGISTERED");
  assert.equal(registrationState("AwaitingApproval", "PaidInFull"), "PENDING");
  assert.equal(registrationState("AwaitingApproval", "Unpaid"), "UNPAID");
  assert.equal(registrationState("Approved", "PaidRegFeesOnly"), "PART_PAID");
  assert.equal(registrationState("AwaitingApproval", "RefundProvided"), "WITHDRAWN");
  assert.equal(registrationState(null, null), "UNKNOWN");
});

test("bank details: encrypted, masked, tamper-evident, never plaintext without a key", async () => {
  process.env.BANK_DETAILS_KEY = randomBytes(32).toString("base64");
  const { sealBank, openBank, maskBank, open } = await import("../lib/bankDetails");
  const s = sealBank({ bsb: "062 000", accountNumber: "12345678", accountName: "Jane Citizen" });
  assert.ok("data" in s);
  const d = (s as { data: { bsb: string; accountNumber: string; accountName: string } }).data;
  assert.ok(Object.values(d).every((v) => v.startsWith("enc:v1:")));
  assert.deepEqual(openBank(d), { bsb: "062-000", accountNumber: "12345678", accountName: "Jane Citizen" });
  assert.equal(maskBank(d).accountNumber, "••••5678");
  assert.throws(() => open(d.accountNumber.slice(0, -2) + (d.accountNumber.endsWith("A") ? "BB" : "AA")));
  assert.ok("error" in sealBank({ bsb: "062000", accountNumber: "1234567890", accountName: "J C" }), "ABA holds 9 digits");
  delete process.env.BANK_DETAILS_KEY;
  assert.throws(() => sealBank({ bsb: "062000", accountNumber: "12345678", accountName: "J C" }));
});

test("calendar feed: valid folding, UTC times, byes all-day", () => {
  const ics = buildIcs({
    name: "Team — Wagga Futsal",
    siteUrl: "https://example.test",
    items: [
      { kind: "game", id: "f1", teamId: "t1", teamName: "Thunder", opponentName: "Vikings with a very long name to force folding", home: true, competition: "U10 Division 1", phase: "REGULAR", round: 1, start: new Date("2026-10-15T05:00:00Z"), durationMins: 30, status: "SCHEDULED", homeScore: 0, awayScore: 0, pitch: "Pitch 1", venue: "EQUEX Multi Purpose Sports Centre", address: "Glenfield Road, Wagga Wagga NSW 2650" },
      { kind: "bye", teamId: "t1", teamName: "Thunder", competition: "U10 Division 1", competitionId: "c1", round: 2, day: "2026-10-22" },
    ],
  });
  assert.ok(ics.endsWith("\r\n"));
  assert.ok(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75));
  const unfolded = ics.replace(/\r\n /g, "");
  assert.ok(unfolded.includes("DTSTART:20261015T050000Z") && unfolded.includes("DTEND:20261015T053000Z"));
  assert.ok(unfolded.includes("DTSTART;VALUE=DATE:20261022"));
});
