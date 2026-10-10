/**
 * Who may change a fixture's live state (status, match events): an admin, or
 * the referee assigned to it as field referee or scorer. Finished fixtures
 * (completed, forfeited, abandoned) can only be changed by an admin, so
 * results can't be reopened from the scoring console.
 */
export const FINISHED = ["COMPLETED", "FORFEITED_HOME", "FORFEITED_AWAY", "ABANDONED"] as const;

export type Caller = { role: string; refereeId: string | null };
export type FixtureRef = { status: string; fieldRefereeId: string | null; scorerId: string | null };

export function fixtureAccess(caller: Caller, fixture: FixtureRef): { ok: true } | { ok: false; status: 403 | 409; error: string } {
  if (fixture.status === "DRAFT") return { ok: false, status: 409, error: "This fixture hasn't been published yet" };
  if (caller.role === "ADMIN") return { ok: true };
  const assigned = !!caller.refereeId && (caller.refereeId === fixture.fieldRefereeId || caller.refereeId === fixture.scorerId);
  if (!assigned) return { ok: false, status: 403, error: "You're not the referee or scorer for this game" };
  if ((FINISHED as readonly string[]).includes(fixture.status)) {
    return { ok: false, status: 403, error: "This game has finished. Ask an administrator to change it." };
  }
  return { ok: true };
}

/** Can this caller open the scoring console for the fixture at all? */
export const canOpenScorer = (caller: Caller, fixture: FixtureRef) =>
  caller.role === "ADMIN" || (!!caller.refereeId && (caller.refereeId === fixture.fieldRefereeId || caller.refereeId === fixture.scorerId));

const EVENT_TYPES = ["GOAL", "YELLOW_CARD", "RED_CARD", "FOUL"] as const;
export type EventInput = { teamId: unknown; type: unknown; minute: unknown; half: unknown };

/** Validate a match event against the fixture: real team, known type, sane half/minute. */
export function validateEvent(e: EventInput, fixture: { homeTeamId: string; awayTeamId: string }) {
  if (e.teamId !== fixture.homeTeamId && e.teamId !== fixture.awayTeamId) return "That team isn't playing in this game";
  if (!(EVENT_TYPES as readonly unknown[]).includes(e.type)) return "Unknown event type";
  const minute = Number(e.minute), half = Number(e.half ?? 1);
  if (!Number.isInteger(minute) || minute < 0 || minute > 60) return "Minute must be 0–60";
  if (half !== 1 && half !== 2) return "Half must be 1 or 2";
  return null;
}
