import { adminPage } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { flaggedExpected } from "@/lib/squadReview";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await adminPage(); // own check: layouts don't re-run on every navigation
  const [players, teams, competitions, liveFixtures, upcomingFixtures, pendingBookings, squadReview, draftsByComp] =
    await Promise.all([
      prisma.player.count(),
      prisma.team.count(),
      prisma.competition.count({ where: { status: { in: ["ACTIVE", "FINALS"] } } }),
      prisma.fixture.count({ where: { status: "LIVE" } }),
      prisma.fixture.count({ where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } } }),
      prisma.sessionBooking.count({ where: { status: "CONFIRMED" } }),
      flaggedExpected(),
      prisma.fixture.groupBy({ by: ["competitionId"], where: { status: "DRAFT" }, _count: true }),
    ]);
  const draftFixtures = draftsByComp.reduce((n, g) => n + g._count, 0);

  const pendingTeams = squadReview.filter((t) => t.status === "PENDING").length;
  const flaggedPlayers = squadReview.reduce((n, t) => n + t.flagged.length, 0);

  const stats = [
    { label: "Players", value: players, href: "/admin/players" },
    { label: "Teams", value: teams, href: "/admin/teams" },
    { label: "Active Competitions", value: competitions, href: "/admin/competitions" },
    { label: "Live Now", value: liveFixtures, href: "/admin/fixtures", highlight: liveFixtures > 0 },
    { label: "Upcoming Fixtures", value: upcomingFixtures, href: "/admin/fixtures" },
    { label: "Confirmed Bookings", value: pendingBookings, href: "/admin/sessions" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-black text-navy mb-6">Dashboard</h1>

      {(pendingTeams > 0 || flaggedPlayers > 0 || draftFixtures > 0) && (
        <Link
          href={pendingTeams > 0 || flaggedPlayers > 0 ? "/admin/teams" : "/admin/fixtures"}
          className="block mb-6 bg-amber-50 border border-amber-300 rounded-xl p-4 hover:border-amber-500 transition-colors"
        >
          <p className="font-bold text-amber-800 text-sm">Needs review</p>
          <p className="text-xs text-amber-800 mt-1">
            {[
              pendingTeams > 0 && `${pendingTeams} team nomination${pendingTeams === 1 ? "" : "s"} awaiting approval`,
              flaggedPlayers > 0 && `${flaggedPlayers} nominated player${flaggedPlayers === 1 ? "" : "s"} ineligible — authorise or reject`,
              draftFixtures > 0 &&
                `${draftFixtures} draft fixture${draftFixtures === 1 ? "" : "s"} in ${draftsByComp.length} competition${draftsByComp.length === 1 ? "" : "s"} not yet published`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </Link>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`bg-white border rounded-xl p-5 hover:border-brand transition-colors ${
              s.highlight ? "border-live" : "border-border"
            }`}
          >
            <p className="text-3xl font-black text-navy">{s.value}</p>
            <p className="text-sm text-muted mt-1">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { href: "/admin/players", label: "Import Players (CSV)", desc: "Upload PlayFootball export" },
          { href: "/admin/competitions", label: "Generate Draw", desc: "Create round-robin fixtures" },
          { href: "/admin/competitions", label: "Start Finals Series", desc: "Generate top 4 semi-finals" },
          { href: "/admin/sessions", label: "Create Session", desc: "Add a new paid futsal session" },
        ].map((a) => (
          <Link
            key={a.href + a.label}
            href={a.href}
            className="flex items-center gap-3 bg-white border border-border rounded-xl p-4 hover:border-brand transition-colors"
          >
            <div>
              <p className="font-semibold text-navy text-sm">{a.label}</p>
              <p className="text-xs text-muted">{a.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
