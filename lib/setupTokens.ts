import { createHash, randomBytes } from "node:crypto";

/** Pure helpers for password setup links (no database), shared with tests. */
export const SETUP_LINK_DAYS = 7;
export const SETUP_PATH = "/referee/login/setup";

/** 32 random bytes, URL-safe. Shown once; only its hash is stored. */
export const newSetupToken = () => randomBytes(32).toString("base64url");
export const hashSetupToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const setupLinkExpiry = (from = new Date()) => new Date(from.getTime() + SETUP_LINK_DAYS * 24 * 60 * 60 * 1000);
export const setupUrl = (siteUrl: string, token: string) => `${siteUrl.replace(/\/$/, "")}${SETUP_PATH}?token=${token}`;
/** Plausible token shape (cheap pre-check before touching the database). */
export const looksLikeSetupToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{43}$/.test(t);
