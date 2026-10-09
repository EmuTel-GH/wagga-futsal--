import Link from "next/link";
import type { Metadata } from "next";
import AddToCalendar from "@/components/public/AddToCalendar";
import ScheduleList from "@/components/public/ScheduleList";
import TeamSearch from "@/components/public/TeamSearch";
import { teamSchedule } from "@/lib/teamSchedule";
import { sydneyDateKey } from "@/lib/breakDates";
import LoadSavedTeams from "./LoadSavedTeams";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My teams' fixtures — Wagga Futsal" };

const PLAYED = ["COMPLETED", "FORFEITED_HOME", "FORFEITED_AWAY"];

// Every fixture (and bye) for the teams you follow, in one list and one
// calendar. Teams come from ?teams=a,b (so the link can be shared), or from
// the teams saved in this browser.
export default async function MyTeamsPage({ searchParams }: { searchParams: Promise<{ teams?: string; past?: string }> }) {
  const sp = await searchParams;
  const ids = (sp.teams ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const { teams, items } = ids.length ? await teamSchedule(ids) : { teams: [], items: [] };
  const today = sydneyDateKey(new Date());
  const showPast = sp.past === "1";
  const shown = items.filter((i) =>
    showPast ? true : i.kind === "bye" ? i.day >= today : sydneyDateKey(i.start) >= today && !PLAYED.includes(i.status)
  );
  const query = `teams=${teams.map((t) => t.id).join(",")}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <LoadSavedTeams loadNow={!ids.length} />
      <h1 className="text-3xl font-black text-navy mb-2">My teams&apos; fixtures</h1>
      <p className="text-sm text-muted mb-5">
        Every game and bye for the teams you follow, in one place. All games are at the EQUEX centre, Glenfield Road.
      </p>

      <div className="bg-navy rounded-2xl p-4 mb-6">
        <p className="text-white/70 text-xs font-semibold mb-2">Find a team and tap it to add it here</p>
        <TeamSearch stayOnPage placeholder="Search for a team to add…" />
      </div>

      {teams.length === 0 ? (
        <p className="text-sm text-muted bg-white border border-border rounded-xl p-5">
          No teams yet. Search for your team above, or open a team&apos;s page and tap <span className="font-semibold">☆ Save team</span>.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {teams.map((t) => (
              <Link key={t.id} href={`/teams/${t.id}`}
                className="bg-white border border-brand/30 hover:border-brand rounded-full px-3 py-1.5 text-sm font-semibold text-navy">
                {t.name}
              </Link>
            ))}
            <span className="ml-auto">
              <AddToCalendar feedPath={`/api/calendar?${query}`} name={teams.length === 1 ? `${teams[0].name} — Wagga Futsal` : "My teams — Wagga Futsal"} />
            </span>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-black text-navy">{showPast ? "All fixtures and results" : "Coming up"}</h2>
            <Link href={`/my-teams?${query}${showPast ? "" : "&past=1"}`} className="text-sm text-brand font-semibold hover:underline">
              {showPast ? "Upcoming only" : "Include past results"}
            </Link>
          </div>
          {shown.length ? (
            <ScheduleList items={shown} showTeam={teams.length > 1} />
          ) : (
            <p className="text-sm text-muted bg-white border border-border rounded-xl p-5">
              No upcoming games published yet. Add the calendar and they&apos;ll appear there automatically once the draw is out.
            </p>
          )}
        </>
      )}
    </div>
  );
}
