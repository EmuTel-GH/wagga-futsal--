import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import TeamNominationForm from "./TeamNominationForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nominate a Team" };

export default async function TeamRegisterPage() {
  const competitions = await prisma.competition.findMany({
    where: { status: { in: ["REGISTRATION", "ACTIVE"] } },
    select: { id: true, name: true, season: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <p className="text-brand text-xs font-bold uppercase tracking-widest mb-1">Summer 2026/27</p>
      <h1 className="text-4xl font-black text-navy leading-tight mb-3">Nominate a Team</h1>
      <p className="text-muted mb-8">
        Coaches and managers: enter your team here. Every player also needs their own{" "}
        <a
          href="https://registration.playfootball.com.au/participant/find-products?referrer_entity_id=75505&page=1"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand font-semibold hover:underline"
        >
          PlayFootball registration
        </a>{" "}
        — list your expected players below even if they haven&apos;t registered yet.
      </p>

      <TeamNominationForm competitions={competitions} />
    </div>
  );
}
