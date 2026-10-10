import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ScorerConsole from "./ScorerConsole";

export const dynamic = "force-dynamic";

export default async function ScorerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const fixture = await prisma.fixture.findUnique({
    where: { id },
    // Only what the scoring console shows: names and shirt numbers, never
    // dates of birth, registration ids or team contacts.
    select: {
      id: true,
      status: true,
      fieldRefereeId: true,
      scorerId: true,
      homeScore: true,
      awayScore: true,
      homeFoulsH1: true,
      awayFoulsH1: true,
      homeFoulsH2: true,
      awayFoulsH2: true,
      homeTeam: { select: { id: true, name: true, players: { select: { id: true, jerseyNumber: true, player: { select: { id: true, firstName: true, lastName: true } } } } } },
      awayTeam: { select: { id: true, name: true, players: { select: { id: true, jerseyNumber: true, player: { select: { id: true, firstName: true, lastName: true } } } } } },
      competition: { select: { name: true } },
      events: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, type: true, minute: true, half: true, playerName: true, jerseyNumber: true, team: { select: { name: true } } },
      },
    },
  });

  // Unpublished (draft) fixtures can't be scored.
  if (!fixture || fixture.status === "DRAFT") notFound();

  // The assignment ids are for the server-side check only; keep them out of the page.
  const { fieldRefereeId: _f, scorerId: _s, ...shown } = fixture;
  return <ScorerConsole fixture={shown} />;
}
