import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Referees' bank details are encrypted in the app (AES-256-GCM) before they
 * reach the database, with the key only in the server's private .env
 * (BANK_DETAILS_KEY, 32 random bytes, base64). A database dump or backup on
 * its own reveals nothing. Pages only ever get a masked version; full numbers
 * are decrypted on the server just to build the ABA payment file.
 *
 * Stored format: "enc:v2:<iv>:<tag>:<ciphertext>" (base64 parts). The
 * referee's id and the field name are bound in as associated data, so a value
 * copied to another referee or another field fails to decrypt. "enc:v1:"
 * (no associated data) is still read, for details saved before v2.
 */
const V1 = "enc:v1:";
const V2 = "enc:v2:";
const TAG_BYTES = 16;

export type BankField = "bsb" | "accountNumber" | "accountName";

function key() {
  const raw = process.env.BANK_DETAILS_KEY;
  const k = raw ? Buffer.from(raw, "base64") : null;
  if (!k || k.length !== 32) throw new Error("BANK_DETAILS_KEY is not configured (32 bytes, base64)");
  return k;
}

const aad = (refereeId: string, field: BankField) => Buffer.from(`referee:${refereeId}:${field}`, "utf8");

export function seal(plain: string, refereeId: string, field: BankField) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv, { authTagLength: TAG_BYTES });
  c.setAAD(aad(refereeId, field));
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `${V2}${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${ct.toString("base64")}`;
}

export function open(stored: string | null, refereeId: string, field: BankField): string | null {
  if (!stored) return null;
  const v2 = stored.startsWith(V2);
  // Everything is encrypted (checked in production 2026-10-11); refuse anything else.
  if (!v2 && !stored.startsWith(V1)) throw new Error("Bank details are not in the encrypted format");
  const parts = stored.slice(V2.length).split(":");
  if (parts.length !== 3) throw new Error("Bank details are damaged");
  const [iv, tag, ct] = parts.map((p) => Buffer.from(p, "base64"));
  if (iv.length !== 12 || tag.length !== TAG_BYTES) throw new Error("Bank details are damaged");
  const d = createDecipheriv("aes-256-gcm", key(), iv, { authTagLength: TAG_BYTES });
  if (v2) d.setAAD(aad(refereeId, field));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

type Stored = { id: string; bsb: string | null; accountNumber: string | null; accountName: string | null };

/** Full details (server only: ABA file). */
export function openBank(r: Stored) {
  return {
    bsb: open(r.bsb, r.id, "bsb"),
    accountNumber: open(r.accountNumber, r.id, "accountNumber"),
    accountName: open(r.accountName, r.id, "accountName"),
  };
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
export function sealBank(input: { bsb?: unknown; accountNumber?: unknown; accountName?: unknown }, refereeId: string) {
  const bsb = String(input.bsb ?? "").replace(/[\s-]/g, "");
  const acct = String(input.accountNumber ?? "").replace(/[\s-]/g, "");
  const name = String(input.accountName ?? "").trim().replace(/\s+/g, " ");
  if (!/^\d{6}$/.test(bsb)) return { error: "BSB must be 6 digits" } as const;
  if (!/^\d{5,9}$/.test(acct)) return { error: "Account number must be 5–9 digits (the ABA payment file holds 9)" } as const;
  if (name.length < 2 || name.length > 32) return { error: "Account name must be 2–32 characters (as it appears on the account)" } as const;
  return {
    data: {
      bsb: seal(`${bsb.slice(0, 3)}-${bsb.slice(3)}`, refereeId, "bsb"),
      accountNumber: seal(acct, refereeId, "accountNumber"),
      accountName: seal(name, refereeId, "accountName"),
    },
  } as const;
}
