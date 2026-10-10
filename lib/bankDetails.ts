import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Referees' bank details are encrypted in the app (AES-256-GCM) before they
 * reach the database, with the key only in the server's private .env
 * (BANK_DETAILS_KEY, 32 random bytes, base64). A database dump or backup on
 * its own reveals nothing. Pages only ever get a masked version; full numbers
 * are decrypted on the server just to build the ABA payment file.
 *
 * Stored format: "enc:v1:<iv>:<tag>:<ciphertext>" (base64 parts). Values
 * without the prefix are legacy plaintext and still read correctly.
 */
const PREFIX = "enc:v1:";

function key() {
  const raw = process.env.BANK_DETAILS_KEY;
  const k = raw ? Buffer.from(raw, "base64") : null;
  if (!k || k.length !== 32) throw new Error("BANK_DETAILS_KEY is not configured (32 bytes, base64)");
  return k;
}

export function seal(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `${PREFIX}${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${ct.toString("base64")}`;
}

export function open(stored: string | null): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext
  const [iv, tag, ct] = stored.slice(PREFIX.length).split(":").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

type Stored = { bsb: string | null; accountNumber: string | null; accountName: string | null };

/** Full details (server only: ABA file). */
export function openBank(r: Stored) {
  return { bsb: open(r.bsb), accountNumber: open(r.accountNumber), accountName: open(r.accountName) };
}

/** What pages may see: BSB 062-•••, account ••••5678, holder name. */
export function maskBank(r: Stored) {
  const has = !!(r.bsb && r.accountNumber && r.accountName);
  if (!has) return { bsb: null, accountNumber: null, accountName: null, hasBankDetails: false };
  try {
    const { bsb, accountNumber, accountName } = openBank(r);
    return {
      bsb: `${bsb!.replace(/\D/g, "").slice(0, 3)}-•••`,
      accountNumber: `••••${accountNumber!.replace(/\D/g, "").slice(-4)}`,
      accountName,
      hasBankDetails: true,
    };
  } catch {
    return { bsb: "•••", accountNumber: "•••• (locked)", accountName: "•••", hasBankDetails: true };
  }
}

/** Validate + normalise input, then encrypt. BSB is 6 digits, account 5–9 digits (ABA limit). */
export function sealBank(input: { bsb?: unknown; accountNumber?: unknown; accountName?: unknown }) {
  const bsb = String(input.bsb ?? "").replace(/[\s-]/g, "");
  const acct = String(input.accountNumber ?? "").replace(/[\s-]/g, "");
  const name = String(input.accountName ?? "").trim().replace(/\s+/g, " ");
  if (!/^\d{6}$/.test(bsb)) return { error: "BSB must be 6 digits" } as const;
  if (!/^\d{5,9}$/.test(acct)) return { error: "Account number must be 5–9 digits (the ABA payment file holds 9)" } as const;
  if (name.length < 2 || name.length > 32) return { error: "Account name must be 2–32 characters (as it appears on the account)" } as const;
  return { data: { bsb: seal(`${bsb.slice(0, 3)}-${bsb.slice(3)}`), accountNumber: seal(acct), accountName: seal(name) } } as const;
}
