import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// Replace the team's EXPECTED squad — the player names off the team
// registration form. One name per line ("First Last"); these are matched
// against actual PlayFootball registrations in the admin UI.
export async function POST(req: Request, { params }: Params) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const { names } = await req.json();
  if (typeof names !== "string") {
    return NextResponse.json({ error: "names (multiline string) is required" }, { status: 400 });
  }

  const parsed = names
    .split("\n")
    .map((l) => l.replace(/^\s*\d+[.)]?\s*/, "").trim()) // tolerate "1. Name" numbering
    .filter(Boolean)
    .map((full) => {
      const parts = full.split(/\s+/);
      return parts.length === 1
        ? { firstName: parts[0], lastName: "" }
        : { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
    });

  const expected = await prisma.$transaction(async (tx) => {
    await tx.expectedPlayer.deleteMany({ where: { teamId } });
    await tx.expectedPlayer.createMany({ data: parsed.map((p) => ({ ...p, teamId })) });
    return tx.expectedPlayer.findMany({ where: { teamId }, orderBy: { createdAt: "asc" } });
  });

  return NextResponse.json(expected, { status: 201 });
}
