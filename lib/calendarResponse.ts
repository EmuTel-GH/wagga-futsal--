import { NextResponse } from "next/server";
import { teamSchedule } from "./teamSchedule";
import { buildIcs } from "./ics";

export const siteUrl = (req: Request) => (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");

/** An .ics feed for the given teams. ?download=1 saves a file instead of subscribing. */
export async function calendarResponse(req: Request, teamIds: string[]) {
  const { teams, items } = await teamSchedule(teamIds);
  if (!teams.length) return new NextResponse("Team not found", { status: 404 });
  const name = teams.length === 1 ? `${teams[0].name} — Wagga Futsal` : "My teams — Wagga Futsal";
  const ics = buildIcs({ name, items, siteUrl: siteUrl(req) });
  const file = (teams.length === 1 ? teams[0].name : "my-teams").toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-wagga-futsal.ics";
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${file}"`,
      "Cache-Control": "public, max-age=900",
    },
  });
}
