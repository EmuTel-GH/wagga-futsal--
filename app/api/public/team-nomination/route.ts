import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public team nomination — the online replacement for the emailed team
// registration form. Creates the team (with contact + kit details), links it
// to the chosen competition and records the expected squad for the admins to
// reconcile against PlayFootball registrations.
export async function POST(req: Request) {
  const body = await req.json();
  const { teamName, competitionId, contactName, contactEmail, contactPhone, kitShirt, kitShorts, kitSocks, players, website } = body;

  // Honeypot: real users never fill this hidden field.
  if (website) return NextResponse.json({ ok: true });

  if (!teamName || !competitionId || !contactName || !contactEmail) {
    return NextResponse.json(
      { error: "Team name, competition, contact name and contact email are required" },
      { status: 400 }
    );
  }
  if (String(teamName).length > 60) {
    return NextResponse.json({ error: "Team name too long" }, { status: 400 });
  }

  const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
  if (!competition || !["REGISTRATION", "ACTIVE"].includes(competition.status)) {
    return NextResponse.json({ error: "That competition is not open for nominations" }, { status: 400 });
  }

  // A pending nomination with the same name is a double-submit — block it.
  // An APPROVED team with the same name is fine: the nomination arrives as
  // PENDING and the admins merge it into the existing team.
  const pendingDuplicate = await prisma.competitionTeam.findFirst({
    where: {
      competitionId,
      team: { name: { equals: String(teamName).trim(), mode: "insensitive" }, status: "PENDING" },
    },
  });
  if (pendingDuplicate) {
    return NextResponse.json(
      { error: "That team has already been nominated and is awaiting approval — contact admin@waggafutsal.com.au if you need to change it." },
      { status: 409 }
    );
  }

  const expectedNames: { firstName: string; lastName: string }[] = String(players ?? "")
    .split("\n")
    .map((l: string) => l.replace(/^\s*\d+[.)]?\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 15)
    .map((full: string) => {
      const parts = full.split(/\s+/);
      return parts.length === 1
        ? { firstName: parts[0], lastName: "" }
        : { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
    });

  const team = await prisma.team.create({
    data: {
      status: "PENDING", // admin approves or merges into an existing team
      name: String(teamName).trim(),
      contactName: String(contactName).trim(),
      contactEmail: String(contactEmail).trim(),
      contactPhone: contactPhone ? String(contactPhone).trim() : null,
      kitShirt: kitShirt ? String(kitShirt).trim() : null,
      kitShorts: kitShorts ? String(kitShorts).trim() : null,
      kitSocks: kitSocks ? String(kitSocks).trim() : null,
      competitions: { create: { competitionId } },
      expected: { createMany: { data: expectedNames } },
    },
  });

  return NextResponse.json({ ok: true, teamId: team.id }, { status: 201 });
}
