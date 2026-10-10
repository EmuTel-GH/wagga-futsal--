import type { ScheduleItem } from "./teamSchedule";

/**
 * iCalendar (RFC 5545) feed for team schedules. Served for SUBSCRIPTION
 * (webcal://), so phones and Google re-fetch it and pick up draw changes,
 * moved rounds and finals by themselves. UIDs are stable per fixture/bye, so
 * an updated fixture replaces its event rather than duplicating it.
 */

// RFC 5545 TEXT escaping: backslash, semicolon, comma, and any line break.
export const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const day = (key: string) => key.replace(/-/g, "");

// Fold at 75 octets (not characters: emoji and accents are multi-byte).
function fold(line: string) {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const PHASE: Record<string, string> = { SEMI_FINAL: "Semi-final", THIRD_PLACE: "3rd place play-off", GRAND_FINAL: "Grand final" };
const PLAYED = ["COMPLETED", "FORFEITED_HOME", "FORFEITED_AWAY"];

export function buildIcs(opts: { name: string; items: ScheduleItem[]; siteUrl: string }) {
  const { items, siteUrl } = opts;
  const now = utc(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wagga Futsal//Team fixtures//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(opts.name)}`,
    "X-WR-TIMEZONE:Australia/Sydney",
    // Ask clients to re-check every few hours (Apple/Outlook honour these).
    "REFRESH-INTERVAL;VALUE=DURATION:PT4H",
    "X-PUBLISHED-TTL:PT4H",
  ];
  for (const i of items) {
    if (i.kind === "bye") {
      const next = new Date(`${i.day}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      lines.push(
        "BEGIN:VEVENT",
        `UID:bye-${i.competitionId}-${i.round}-${i.teamId}@waggafutsal.com.au`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${day(i.day)}`,
        `DTEND;VALUE=DATE:${utc(next).slice(0, 8)}`,
        `SUMMARY:${esc(`${i.teamName} — BYE (no game this week)`)}`,
        `DESCRIPTION:${esc(`${i.competition}, round ${i.round}: ${i.teamName} has the bye.`)}`,
        "TRANSP:TRANSPARENT",
        "END:VEVENT"
      );
      continue;
    }
    const end = new Date(i.start.getTime() + i.durationMins * 60000);
    const label = PHASE[i.phase] ? ` (${PHASE[i.phase]})` : "";
    const result = PLAYED.includes(i.status)
      ? ` — FT ${i.home ? i.homeScore : i.awayScore}–${i.home ? i.awayScore : i.homeScore}`
      : "";
    const location = [i.pitch, i.venue, i.address].filter(Boolean).join(", ");
    const description = [
      `${i.competition}${i.phase === "REGULAR" ? `, round ${i.round}` : label}`,
      `${i.teamName} v ${i.opponentName}${i.home ? " (home)" : " (away)"}`,
      location && `Where: ${location}`,
      `Draw, results and ladder: ${siteUrl}/teams/${i.teamId}`,
    ].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:fixture-${i.id}-${i.teamId}@waggafutsal.com.au`,
      `DTSTAMP:${now}`,
      `DTSTART:${utc(i.start)}`,
      `DTEND:${utc(end)}`,
      `SUMMARY:${esc(`${i.teamName} v ${i.opponentName}${label}${result}`)}`,
      `LOCATION:${esc(location || "EQUEX Multi Purpose Sports Centre, Wagga Wagga")}`,
      `DESCRIPTION:${esc(description)}`,
      `URL:${siteUrl}/teams/${i.teamId}`,
      `STATUS:${i.status === "ABANDONED" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
