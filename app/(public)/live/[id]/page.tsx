import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { publicFixtureSelect } from "@/lib/publicFixture";
import LiveMatchClient from "./LiveMatchClient";

export const dynamic = "force-dynamic";

// Draft fixtures aren't public yet, so they 404 like a missing one.
async function getFixture(id: string) {
  return prisma.fixture.findFirst({
    where: { id, status: { not: "DRAFT" } },
    select: publicFixtureSelect, // public: no team contacts, notes or referee ids
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const fixture = await getFixture(id);
  if (!fixture) return {};

  const score = `${fixture.homeTeam.name} ${fixture.homeScore} – ${fixture.awayScore} ${fixture.awayTeam.name}`;
  const status = fixture.status === "LIVE" ? "🔴 LIVE" : fixture.status === "COMPLETED" ? "Full Time" : "Upcoming";

  return {
    title: `${status}: ${score}`,
    description: `${fixture.competition.name} · ${score}`,
    openGraph: {
      title: `${status}: ${score}`,
      description: `${fixture.competition.name} · Follow the action live on Wagga Futsal`,
      type: "website",
    },
  };
}

export default async function LiveMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fixture = await getFixture(id);
  if (!fixture) notFound();

  return <LiveMatchClient fixture={fixture} />;
}
