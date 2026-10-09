/**
 * Splitting a competition into divisions part-way through a season (e.g. play
 * everyone once, then top half / bottom half). Pure helpers shared by the
 * admin preview and the split API, so both agree on the defaults.
 */

export type SplitSlot = { id: string; dayOfWeek: number; startTime: string; pitchId: string; pitchName?: string; durationMins: number };

const DEFAULT_SUFFIXES = [["Division 1", "Division 2"], ["Gold", "Silver", "Bronze"], ["Division 1", "Division 2", "Division 3", "Division 4"]];

/** Suggested names: "<comp> Division 1/2", "<comp> Gold/Silver/Bronze", ... */
export function defaultDivisionNames(compName: string, count: number) {
  const suffixes = DEFAULT_SUFFIXES.find((s) => s.length === count) ?? Array.from({ length: count }, (_, i) => `Division ${i + 1}`);
  return suffixes.map((s) => `${compName} – ${s}`);
}

/**
 * Default team → division by ladder position: top teams in division 0, and
 * so on, as evenly as possible (earlier divisions take the extra team).
 */
export function defaultAssignment(ladderTeamIds: string[], count: number) {
  const out: Record<string, number> = {};
  const base = Math.floor(ladderTeamIds.length / count);
  const extra = ladderTeamIds.length % count;
  let i = 0;
  for (let d = 0; d < count; d++) {
    const size = base + (d < extra ? 1 : 0);
    for (let k = 0; k < size; k++) out[ladderTeamIds[i++]] = d;
  }
  return out;
}

/**
 * Share the competition's weekly time slots between the divisions, so two
 * divisions are never drawn into the same pitch at the same time. Slots are
 * dealt out in day/time order like cards. With fewer slots than divisions,
 * every division gets every slot and `clash` warns the admin to fix it.
 */
export function distributeSlots<T extends SplitSlot>(slots: T[], count: number): { perDivision: T[][]; clash: boolean } {
  const sorted = [...slots].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime) || (a.pitchName ?? a.pitchId).localeCompare(b.pitchName ?? b.pitchId)
  );
  if (sorted.length < count) return { perDivision: Array.from({ length: count }, () => sorted), clash: sorted.length > 0 };
  const perDivision: T[][] = Array.from({ length: count }, () => []);
  sorted.forEach((s, i) => perDivision[i % count].push(s));
  return { perDivision, clash: false };
}

/** Problems with a proposed split, or [] if it's valid. */
export function validateSplit(divisions: { name: string; teamIds: string[] }[], allTeamIds: string[]) {
  const errors: string[] = [];
  if (divisions.length < 2) errors.push("Split into at least 2 divisions.");
  const names = divisions.map((d) => d.name.trim().toLowerCase());
  if (names.some((n) => !n)) errors.push("Every division needs a name.");
  if (new Set(names).size !== names.length) errors.push("Division names must be different.");
  divisions.forEach((d, i) => {
    if (d.teamIds.length < 2) errors.push(`${d.name.trim() || `Division ${i + 1}`} needs at least 2 teams.`);
  });
  const assigned = divisions.flatMap((d) => d.teamIds);
  if (new Set(assigned).size !== assigned.length) errors.push("A team is in more than one division.");
  if (allTeamIds.some((t) => !assigned.includes(t)) || assigned.some((t) => !allTeamIds.includes(t))) {
    errors.push("Every team in the competition must go into exactly one division.");
  }
  return errors;
}
