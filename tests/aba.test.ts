import { test } from "node:test";
import assert from "node:assert/strict";
import { generateABA, ABAError, type ABAOptions, type ABAPayee } from "../lib/aba";

const opts: ABAOptions = {
  bankMnemonic: "wbc",
  userName: "Wagga Futsal Inc",
  userBsb: "032-001",
  userAccount: "123456",
  apcaId: "301500",
  description: "Game fees",
  // 20:00 UTC on the 10th is 07:00 on the 11th in Sydney: the file must say the 11th.
  processingDate: new Date("2026-10-10T20:00:00Z"),
};
const payees: ABAPayee[] = [
  { bsb: "062-000", accountNumber: "12345678", accountName: "José O'Brien", amountCents: 7500, reference: "WAGGA FUTSAL GAME FEE" },
  { bsb: "633000", accountNumber: "123456789", accountName: "Sam\r\nSmith 🎉", amountCents: 2500, reference: "WAGGA FUTSAL GAME FEE" },
];
// 1-based inclusive column ranges, as the BECS spec writes them.
const col = (line: string, from: number, to: number) => line.slice(from - 1, to);
const records = (file: string) => {
  assert.ok(file.endsWith("\r\n"), "every record ends with CR LF");
  return file.slice(0, -2).split("\r\n");
};

test("every record is exactly 120 characters, CR LF terminated, 7-bit ASCII", () => {
  const file = generateABA(payees, opts);
  const lines = records(file);
  assert.equal(lines.length, 4);
  for (const l of lines) assert.equal(l.length, 120);
  assert.match(file, /^[\x20-\x7e\r\n]*$/);
});

test("descriptive record (type 0) fields sit in the spec's columns", () => {
  const [h] = records(generateABA(payees, opts));
  assert.equal(col(h, 1, 1), "0");
  assert.equal(col(h, 2, 18), " ".repeat(17));
  assert.equal(col(h, 19, 20), "01");
  assert.equal(col(h, 21, 23), "WBC");
  assert.equal(col(h, 24, 30), " ".repeat(7));
  assert.equal(col(h, 31, 56), "WAGGA FUTSAL INC".padEnd(26));
  assert.equal(col(h, 57, 62), "301500");
  assert.equal(col(h, 63, 74), "GAME FEES".padEnd(12));
  assert.equal(col(h, 75, 80), "111026", "Sydney date, not UTC");
  assert.equal(col(h, 81, 120), " ".repeat(40));
});

test("detail records (type 1) fields sit in the spec's columns, text cleaned", () => {
  const [, a, b] = records(generateABA(payees, opts));
  assert.equal(col(a, 1, 1), "1");
  assert.equal(col(a, 2, 8), "062-000");
  assert.equal(col(a, 9, 17), " 12345678");
  assert.equal(col(a, 18, 18), " ");
  assert.equal(col(a, 19, 20), "50");
  assert.equal(col(a, 21, 30), "0000007500");
  assert.equal(col(a, 31, 62), "JOSE O'BRIEN".padEnd(32), "accent dropped, uppercased");
  assert.equal(col(a, 63, 80), "WAGGA FUTSAL GAME ", "reference cut to 18");
  assert.equal(col(a, 81, 87), "032-001");
  assert.equal(col(a, 88, 96), "   123456");
  assert.equal(col(a, 97, 112), "WAGGA FUTSAL INC");
  assert.equal(col(a, 113, 120), "00000000");
  assert.equal(col(b, 2, 8), "633-000", "BSB without a dash is formatted");
  assert.equal(col(b, 9, 17), "123456789");
  assert.equal(col(b, 31, 62), "SAM SMITH".padEnd(32), "line breaks and emoji removed");
});

test("file total record (type 7) adds up", () => {
  const [, , , t] = records(generateABA(payees, opts));
  assert.equal(col(t, 1, 8), "7999-999");
  assert.equal(col(t, 9, 20), " ".repeat(12));
  assert.equal(col(t, 21, 30), "0000010000", "net");
  assert.equal(col(t, 31, 40), "0000010000", "credits");
  assert.equal(col(t, 41, 50), "0000000000", "debits");
  assert.equal(col(t, 51, 74), " ".repeat(24));
  assert.equal(col(t, 75, 80), "000002");
  assert.equal(col(t, 81, 120), " ".repeat(40));
});

test("input the bank would reject is refused, not silently truncated", () => {
  const bad: [Partial<ABAOptions>, ABAPayee[]][] = [
    [{ apcaId: "3015" }, payees],
    [{ apcaId: "30150X" }, payees],
    [{ bankMnemonic: "Westpac" }, payees],
    [{ userBsb: "032-01" }, payees],
    [{ userAccount: "1234567890" }, payees],
    [{ userName: "🎉" }, payees],
    [{}, [{ ...payees[0], bsb: "06200" }]],
    [{}, [{ ...payees[0], accountNumber: "12345678901" }]],
    [{}, [{ ...payees[0], accountName: "  " }]],
    [{}, [{ ...payees[0], amountCents: 0 }]],
    [{}, [{ ...payees[0], amountCents: 10.5 }]],
    [{}, [{ ...payees[0], amountCents: 10_000_000_000 }]],
  ];
  for (const [o, p] of bad) assert.throws(() => generateABA(p, { ...opts, ...o }), ABAError, JSON.stringify([o, p[0]]));
});
