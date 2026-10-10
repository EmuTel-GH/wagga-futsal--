import { adminPage } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { dateKey } from "@/lib/breaks";
import BreaksClient from "./BreaksClient";

export const dynamic = "force-dynamic";

export default async function BreaksPage() {
  await adminPage(); // own check: layouts don't re-run on every navigation
  const [breaks, competitions] = await Promise.all([
    prisma.fixtureBreak.findMany({
      include: { competition: { select: { id: true, name: true } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.competition.findMany({
      where: { status: { not: "COMPLETED" } },
      select: { id: true, name: true, season: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <Link href="/admin/fixtures" className="text-xs text-brand font-semibold hover:underline">← Fixtures</Link>
      <h1 className="text-2xl font-black text-navy mt-2 mb-2">Breaks &amp; holidays</h1>
      <p className="text-sm text-muted mb-6 max-w-2xl">
        Dates with no games: public holidays, school holidays, the Christmas break. New draws skip any week where a
        round would land in a break. For draws that already exist, use <span className="font-semibold">Move games out
        of breaks</span> on the Fixtures page. Upcoming breaks are shown on the public competition page.
      </p>
      <BreaksClient
        initialBreaks={breaks.map((b) => ({
          id: b.id,
          name: b.name,
          startDate: dateKey(b.startDate),
          endDate: dateKey(b.endDate),
          competition: b.competition,
        }))}
        competitions={competitions}
      />
    </div>
  );
}
