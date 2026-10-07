import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ScorerConsole from "./ScorerConsole";

export const dynamic = "force-dynamic";

export default async function ScorerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const fixture = await prisma.fixture.findUnique({
    where: { id },
    include: {
      homeTeam: { include: { players: { include: { player: true } } } },
      awayTeam: { include: { players: { include: { player: true } } } },
      competition: true,
      events: { orderBy: { createdAt: "desc" }, include: { team: true }, take: 20 },
    },
  });

  // Unpublished (draft) fixtures can't be scored.
  if (!fixture || fixture.status === "DRAFT") notFound();

  return <ScorerConsole fixture={fixture} />;
}
