/**
 * Break date logic, with no database access, so client components can use it
 * too. Breaks: periods with no games (public holidays, school holidays, Christmas).
 * Dates are whole Sydney calendar days, compared as "YYYY-MM-DD" strings so
 * daylight saving and UTC offsets can't push a game across a boundary.
 */

export type BreakRange = { id?: string; name: string; startDate: Date | string; endDate: Date | string; competitionId?: string | null };

const sydneyDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" });

/** The Sydney calendar date of an instant, as YYYY-MM-DD. */
export function sydneyDateKey(d: Date) {
  return sydneyDay.format(d);
}

/** A @db.Date value (UTC midnight) or "YYYY-MM-DD" string as YYYY-MM-DD. */
export function dateKey(d: Date | string) {
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

/** The break (if any) that a game at this instant falls in. */
export function breakFor(at: Date, breaks: BreakRange[]) {
  const day = sydneyDateKey(at);
  return breaks.find((b) => dateKey(b.startDate) <= day && day <= dateKey(b.endDate));
}

const MAX_SKIP_WEEKS = 104;

/**
 * Plan how to move a competition's unplayed fixtures out of breaks. Rounds
 * keep their order, weekday, time and pitch: a round that lands in a break
 * moves on a week at a time until clear, and every later round moves by the
 * same amount, so the gaps between rounds are kept and the season runs later.
 */
export function planBreakShifts(
  fixtures: { id: string; round: number; phase: string; scheduledAt: Date }[],
  breaks: BreakRange[]
) {
  // Rounds in calendar order (finals are separate "rounds" per phase).
  const groups = new Map<string, typeof fixtures>();
  for (const f of [...fixtures].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())) {
    const key = `${f.phase}:${f.round}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }

  const moved: { id: string; from: Date; to: Date; breakName: string | null }[] = [];
  let offsetWeeks = 0;
  let cause: string | null = null; // the break that last pushed the season back
  for (const round of groups.values()) {
    const at = (f: { scheduledAt: Date }, weeks: number) => {
      const d = new Date(f.scheduledAt);
      d.setDate(d.getDate() + weeks * 7); // local-date arithmetic keeps the kick-off time across DST
      return d;
    };
    for (let guard = 0; guard < MAX_SKIP_WEEKS; guard++) {
      const hit = round.map((f) => breakFor(at(f, offsetWeeks), breaks)).find(Boolean);
      if (!hit) break;
      cause = hit.name;
      offsetWeeks++;
    }
    if (offsetWeeks === 0) continue;
    for (const f of round) {
      moved.push({ id: f.id, from: f.scheduledAt, to: at(f, offsetWeeks), breakName: cause });
    }
  }
  return { moved, weeksAdded: offsetWeeks };
}
