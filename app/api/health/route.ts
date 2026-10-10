import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Used by the deployer to decide a new version is healthy (and by people to
// see what's live): checks the database answers and reports the version.
export async function GET() {
  const version = process.env.APP_VERSION || "dev";
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, version }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, version }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
