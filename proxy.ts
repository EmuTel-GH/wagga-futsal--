import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateDecision, needsSession, type GateSession } from "@/lib/stagingGate";

/**
 * Runs before every request. In production it does nothing at all. On the
 * staging site (APP_ENV=staging) it only lets signed-in ADMINs through (the
 * session is looked up in the database, not just checked for a cookie) and
 * tells search engines not to index anything. See lib/stagingGate.ts.
 */
export async function proxy(request: NextRequest) {
  const env = process.env.APP_ENV;
  if (env !== "staging") return NextResponse.next();

  const { pathname } = request.nextUrl;
  let session: GateSession = null;
  const token = request.cookies.get("session")?.value;
  if (token && needsSession(env, pathname)) {
    session = await prisma.authSession
      .findUnique({ where: { token }, select: { expiresAt: true, user: { select: { role: true, active: true } } } })
      .catch(() => null); // DB trouble: treat as signed out (fail closed)
  }

  const decision = gateDecision({ env, pathname, session });
  const response =
    decision.action === "next"
      ? NextResponse.next()
      : decision.action === "redirect"
        ? NextResponse.redirect(new URL(decision.location, request.url))
        : NextResponse.json({ error: "Staging: sign in as an administrator" }, { status: 401 });
  if (decision.noindex) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
