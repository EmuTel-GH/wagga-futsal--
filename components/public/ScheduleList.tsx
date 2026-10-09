import Link from "next/link";
import type { ScheduleItem } from "@/lib/teamSchedule";

const PHASE: Record<string, string> = { SEMI_FINAL: "Semi-final", THIRD_PLACE: "3rd place", GRAND_FINAL: "Grand final" };
const PLAYED = ["COMPLETED", "FORFEITED_HOME", "FORFEITED_AWAY"];
const dayLabel = (d: Date) => d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "Australia/Sydney" });
const time = (d: Date) => d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });

// A schedule grouped by day: games (time, opponent, pitch, result) and byes.
// showTeam: prefix each line with the team (My Teams, several teams at once).
export default function ScheduleList({ items, showTeam = false }: { items: ScheduleItem[]; showTeam?: boolean }) {
  const days = new Map<string, ScheduleItem[]>();
  for (const i of items) {
    const key = i.kind === "game" ? dayLabel(i.start) : dayLabel(new Date(`${i.day}T12:00:00+10:00`));
    days.set(key, [...(days.get(key) ?? []), i]);
  }
  return (
    <div className="space-y-4">
      {[...days.entries()].map(([day, list]) => (
        <div key={day}>
          <p className="text-xs font-bold text-muted uppercase tracking-wide mb-1.5">{day}</p>
          <div className="space-y-2">
            {list.map((i) =>
              i.kind === "bye" ? (
                <div key={`bye-${i.teamId}-${i.competitionId}-${i.round}`} className="bg-gray-50 border border-dashed border-border rounded-xl px-4 py-3 text-sm text-muted">
                  {showTeam && <Link href={`/teams/${i.teamId}`} className="font-semibold text-navy hover:text-brand">{i.teamName}: </Link>}
                  <span className="font-semibold">Bye</span>: no game this week ({i.competition}, round {i.round})
                </div>
              ) : (
                <div key={`${i.id}-${i.teamId}`} className={`flex items-center gap-3 bg-white border rounded-xl px-4 py-3 ${i.status === "LIVE" ? "border-live" : "border-border"}`}>
                  <div className="w-16 shrink-0 text-sm font-bold text-navy">{time(i.start)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-navy truncate">
                      {showTeam && <Link href={`/teams/${i.teamId}`} className="hover:text-brand">{i.teamName}</Link>}
                      {showTeam ? " v " : "v "}
                      {i.opponentName}
                      {PHASE[i.phase] && <span className="ml-2 text-xs font-bold text-brand">{PHASE[i.phase]}</span>}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {[i.competition, i.pitch].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    {PLAYED.includes(i.status) ? (
                      <Link href={`/live/${i.id}`} className="font-black text-navy hover:text-brand">
                        {i.home ? i.homeScore : i.awayScore}–{i.home ? i.awayScore : i.homeScore}
                      </Link>
                    ) : i.status === "LIVE" ? (
                      <Link href={`/live/${i.id}`} className="font-bold text-live">LIVE</Link>
                    ) : i.status === "ABANDONED" ? (
                      <span className="text-xs text-muted">Abandoned</span>
                    ) : null}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
