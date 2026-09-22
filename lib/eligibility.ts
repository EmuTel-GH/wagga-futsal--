import type { AgeGroup, DispensationType, Gender } from "@prisma/client";

/**
 * Age eligibility engine — encodes rules 7.2 / 7.4 / 7.5 of the
 * Wagga Futsal Competition Rules.
 *
 * The registered age group comes from the PlayFootball registration import
 * (derived from date of birth against the rule 7.2 bands). A player may not
 * play in a competition outside their registered group except:
 *   - PLAY UP  (rule 7.2): higher group, minimum age met, parent/guardian
 *     consent form approved — recorded as a Dispensation.
 *   - PLAY DOWN (rule 7.5): FEMALE players in MIXED/OPEN competitions may play
 *     one group below their registered group, with approval — recorded as a
 *     Dispensation (approved by the competition administrators).
 */

/**
 * Season start year. Rule 7.2's birth-year cutoffs are season-relative:
 * for the 2025–26 season the U8 cutoff was 1 Jan 2017 (= 2025 − 8), U10 was
 * 1 Jan 2015 (= 2025 − 10), and so on. Bump this once per season.
 */
export const SEASON_START_YEAR = 2026;

type Band = { cutoffOffset: number | null; minAge: number };

// cutoffOffset: born on/after 1 Jan (SEASON_START_YEAR − offset). null = no upper age bound.
// minAge: minimum age (rule 7.2 table; juniors overall 5–16 per rule 1.1).
const BANDS: Partial<Record<AgeGroup, Band>> = {
  U8: { cutoffOffset: 8, minAge: 5 },
  U10: { cutoffOffset: 10, minAge: 8 },
  U12: { cutoffOffset: 12, minAge: 9 },
  U14: { cutoffOffset: 14, minAge: 11 },
  U16: { cutoffOffset: 16, minAge: 13 },
  // Rule 7.2 lists "Under 19s, Opens & Social" together with min age 16.
  // The birth-date bound is only meaningful for U19; OPENS/SOCIAL have no upper age.
  U19: { cutoffOffset: 21, minAge: 16 },
  OPENS: { cutoffOffset: null, minAge: 16 },
  SOCIAL: { cutoffOffset: null, minAge: 16 },
};

/** Youngest → oldest ordering for the groups this club runs. */
const ORDER: AgeGroup[] = ["U8", "U10", "U12", "U14", "U16", "U19", "OPENS", "SOCIAL"];

function ageAtSeasonStart(dob: Date): number {
  // Age on 1 January of the season year, matching the rule's calendar-year bands.
  return SEASON_START_YEAR - dob.getFullYear();
}

function cutoffDate(band: Band): Date | null {
  return band.cutoffOffset === null ? null : new Date(Date.UTC(SEASON_START_YEAR - band.cutoffOffset, 0, 1));
}

/** Does this DOB fit within the age band for the group (rule 7.2 row)? */
export function fitsBand(dob: Date, group: AgeGroup): boolean {
  const band = BANDS[group];
  if (!band) return false;
  const cutoff = cutoffDate(band);
  if (cutoff && dob < cutoff) return false;
  return ageAtSeasonStart(dob) >= band.minAge;
}

/** Minimum age check only — used for play-up (rule 7.2: must meet min age of the higher group). */
export function meetsMinAge(dob: Date, group: AgeGroup): boolean {
  const band = BANDS[group];
  return !!band && ageAtSeasonStart(dob) >= band.minAge;
}

/**
 * The group a player naturally registers in: the youngest group whose band
 * their date of birth fits. Returns null if they fit no band (e.g. under 5).
 */
export function defaultRegisteredGroup(dob: Date): AgeGroup | null {
  for (const g of ORDER) {
    if (g === "SOCIAL") continue; // SOCIAL is a choice, not a default
    if (fitsBand(dob, g)) return g;
  }
  return null;
}

export function groupIndex(g: AgeGroup): number {
  return ORDER.indexOf(g);
}

export type EligibilityResult =
  | { eligible: true; via: "REGISTERED" | "DISPENSATION" }
  | { eligible: false; requires: DispensationType | null; reason: string };

/**
 * Can this player be placed in this competition?
 * `dispensation` is the recorded approval for this player+competition, if any.
 */
export function checkEligibility(opts: {
  dateOfBirth: Date;
  gender: Gender;
  registeredAgeGroup: AgeGroup | null;
  competition: { ageGroup: AgeGroup; gender: Gender; name?: string };
  dispensation?: { type: DispensationType } | null;
}): EligibilityResult {
  const { dateOfBirth: dob, gender, competition: comp, dispensation } = opts;
  const reg = opts.registeredAgeGroup ?? defaultRegisteredGroup(dob);

  // Rule 7.4 — male players may not play in female-only competitions. No override.
  if (comp.gender === "FEMALE" && gender === "MALE") {
    return { eligible: false, requires: null, reason: "Male players cannot play in female-only competitions (rule 7.4)." };
  }

  if (!reg) {
    return { eligible: false, requires: null, reason: "Player does not fit any age band (rule 1.1: juniors must be 5–16)." };
  }

  const regIdx = groupIndex(reg);
  const compIdx = groupIndex(comp.ageGroup);

  // OPENS and SOCIAL are interchangeable senior groups.
  const bothSenior = ["OPENS", "SOCIAL"].includes(reg) && ["OPENS", "SOCIAL"].includes(comp.ageGroup);

  if (compIdx === regIdx || bothSenior) {
    return { eligible: true, via: "REGISTERED" };
  }

  if (compIdx > regIdx) {
    // Playing UP (rule 7.2): min age of the higher group + approved consent form.
    if (!meetsMinAge(dob, comp.ageGroup)) {
      return { eligible: false, requires: null, reason: `Below the minimum age for ${comp.ageGroup} (rule 7.2). No exceptions.` };
    }
    if (dispensation?.type === "PLAY_UP") return { eligible: true, via: "DISPENSATION" };
    return {
      eligible: false,
      requires: "PLAY_UP",
      reason: `Registered ${reg} — playing up to ${comp.ageGroup} needs an approved parent/guardian consent form (rule 7.2).`,
    };
  }

  // Playing DOWN (rule 7.5): female players only, mixed/open comps, ONE group max.
  if (gender !== "FEMALE") {
    return { eligible: false, requires: null, reason: `Registered ${reg} — players cannot play below their registered age group (rule 7.2).` };
  }
  if (comp.gender === "FEMALE") {
    return { eligible: false, requires: null, reason: "Rule 7.5 play-down applies to mixed/open competitions only." };
  }
  if (regIdx - compIdx > 1) {
    return { eligible: false, requires: null, reason: `Rule 7.5 allows playing down one age group only (registered ${reg}).` };
  }
  if (dispensation?.type === "PLAY_DOWN") return { eligible: true, via: "DISPENSATION" };
  return {
    eligible: false,
    requires: "PLAY_DOWN",
    reason: `Registered ${reg} — playing down to ${comp.ageGroup} needs competition administrator approval (rule 7.5).`,
  };
}
