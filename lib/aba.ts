export interface ABAPayee {
  bsb: string;           // XXX-XXX
  accountNumber: string; // digits only, up to 9
  accountName: string;   // up to 32 chars
  amountCents: number;
  reference: string;     // appears on payee's statement, up to 18 chars
}

export interface ABAOptions {
  bankMnemonic: string;      // 3-letter code e.g. 'WBC', 'CBA', 'NAB', 'ANZ'
  userName: string;          // your org name, up to 26 chars
  userBsb: string;           // your BSB XXX-XXX
  userAccount: string;       // your account number, digits only
  apcaId: string;            // 6-digit ID issued by your bank
  description: string;       // e.g. 'GAME FEES', up to 12 chars
  processingDate: Date;
}

/** Thrown for input the bank would reject; the message is safe to show. */
export class ABAError extends Error {}

// BECS character set: letters, digits, space and a few punctuation marks.
// Accents are dropped (é → E); anything else (CR/LF, emoji…) becomes a space.
function bankText(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 &'()*+,\-./]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Left-justified, blank-filled text field. */
function r(s: string, len: number) {
  return bankText(s).substring(0, len).padEnd(len, " ");
}

/** Right-justified, zero-filled number field. */
function n(value: number, len: number) {
  const s = String(value);
  if (!Number.isSafeInteger(value) || value < 0 || s.length > len) throw new ABAError(`Amount or count too large for the file (${s})`);
  return s.padStart(len, "0");
}

function bsb(value: string, what: string) {
  const d = value.replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(d)) throw new ABAError(`${what}: BSB must be 6 digits`);
  return `${d.slice(0, 3)}-${d.slice(3)}`;
}

/** Account number: 1–9 digits, right-justified, blank-filled. */
function account(value: string, what: string) {
  const d = value.replace(/[\s-]/g, "");
  if (!/^\d{1,9}$/.test(d)) throw new ABAError(`${what}: account number must be 1–9 digits`);
  return d.padStart(9, " ");
}

/** Processing date as DDMMYY in Sydney (the bank's day, not UTC's). */
function ddmmyy(d: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", day: "2-digit", month: "2-digit", year: "2-digit" })
      .formatToParts(d)
      .map((p) => [p.type, p.value])
  );
  return `${parts.day}${parts.month}${parts.year}`;
}

export function generateABA(payees: ABAPayee[], opts: ABAOptions): string {
  const lines: string[] = [];
  const mnemonic = opts.bankMnemonic.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(mnemonic)) throw new ABAError("Bank must be a 3-letter code, e.g. WBC");
  const apca = opts.apcaId.trim();
  if (!/^\d{6}$/.test(apca)) throw new ABAError("APCA user ID must be 6 digits");
  if (!bankText(opts.userName)) throw new ABAError("Organisation name is required");
  const traceBsb = bsb(opts.userBsb, "Your account");
  const traceAccount = account(opts.userAccount, "Your account");

  // ── Descriptive record (type 0) ─────────────────────────────────────────
  // 1       '0'
  // 2-18    blank (17)
  // 19-20   reel sequence '01'
  // 21-23   bank mnemonic
  // 24-30   blank (7)
  // 31-56   user name (26)
  // 57-62   APCA user ID (6)
  // 63-74   description (12)
  // 75-80   processing date DDMMYY
  // 81-120  blank (40)
  lines.push(
    "0" +
      " ".repeat(17) +
      "01" +
      mnemonic +
      " ".repeat(7) +
      r(opts.userName, 26) +
      apca +
      r(opts.description, 12) +
      ddmmyy(opts.processingDate) +
      " ".repeat(40)
  );

  let creditTotal = 0;

  // ── Detail records (type 1) ─────────────────────────────────────────────
  // 1       '1'
  // 2-8     BSB (XXX-XXX)
  // 9-17    account number (9, right-justified blank-filled)
  // 18      indicator ' '
  // 19-20   transaction code '50' (externally initiated credit)
  // 21-30   amount in cents (10, right-justified zero-filled)
  // 31-62   title of account (32)
  // 63-80   lodgement reference (18)
  // 81-87   trace BSB (the paying account)
  // 88-96   trace account (9, right-justified blank-filled)
  // 97-112  name of remitter (16)
  // 113-120 withholding tax '00000000'
  for (const p of payees) {
    const amt = p.amountCents;
    if (!Number.isInteger(amt) || amt <= 0) throw new ABAError(`${p.accountName}: amount must be a positive number of cents`);
    if (!bankText(p.accountName)) throw new ABAError("Every payee needs an account name");
    creditTotal += amt;
    lines.push(
      "1" +
        bsb(p.bsb, p.accountName) +
        account(p.accountNumber, p.accountName) +
        " " +
        "50" +
        n(amt, 10) +
        r(p.accountName, 32) +
        r(p.reference, 18) +
        traceBsb +
        traceAccount +
        r(opts.userName, 16) +
        "00000000"
    );
  }

  // ── File total record (type 7) ──────────────────────────────────────────
  // 1       '7'
  // 2-8     '999-999'
  // 9-20    blank (12)
  // 21-30   net total (10)
  // 31-40   credit total (10)
  // 41-50   debit total (10), always 0 for pay runs
  // 51-74   blank (24)
  // 75-80   count of type 1 records (6)
  // 81-120  blank (40)
  lines.push(
    "7" +
      "999-999" +
      " ".repeat(12) +
      n(creditTotal, 10) +
      n(creditTotal, 10) +
      n(0, 10) +
      " ".repeat(24) +
      n(payees.length, 6) +
      " ".repeat(40)
  );

  for (const line of lines) if (line.length !== 120) throw new Error(`ABA record is ${line.length} characters, not 120`);
  // Every record ends with CR LF.
  return lines.map((l) => l + "\r\n").join("");
}
