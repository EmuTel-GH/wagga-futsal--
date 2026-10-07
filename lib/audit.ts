import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Audit log — records every change a signed-in user makes, plus sign-in
 * events. Call it AFTER the change succeeds, from every mutating route.
 *
 * Writing an entry never fails the request: a lost audit row is bad, but
 * telling the admin their change failed when it actually saved is worse.
 */

type Actor = { id: string; email: string; name: string } | null;

export type AuditEntry = {
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string;
  details?: unknown;
};

// Never store credentials or bank details — only that they changed.
// Matches password, passwordHash, token, bsb, accountNumber, orgBsb, orgAccount
// (but not accountName, which is printed on the ABA file anyway).
const REDACT = /pass(word)?|hash|token|secret|bsb|account(number)?$/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT.test(k) ? (v ? "[redacted]" : v) : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 2000) return value.slice(0, 2000) + "…";
  return value;
}

async function clientIp() {
  try {
    const h = await headers();
    // Caddy sets X-Forwarded-For; the left-most entry is the client.
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  } catch {
    return null;
  }
}

export async function audit(actor: Actor | { user: NonNullable<Actor> }, entry: AuditEntry) {
  const user = actor && "user" in actor ? actor.user : actor;
  try {
    await prisma.auditLog.create({
      data: {
        userId: user?.id ?? null,
        actorEmail: user?.email ?? null,
        actorName: user?.name ?? null,
        action: entry.action,
        summary: entry.summary.slice(0, 500),
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        details: entry.details === undefined ? undefined : (redact(entry.details) as Prisma.InputJsonValue),
        ip: await clientIp(),
      },
    });
  } catch (err) {
    console.error("audit log write failed", entry.action, err);
  }
}
