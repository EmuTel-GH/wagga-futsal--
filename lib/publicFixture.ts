import type { Prisma } from "@prisma/client";

/**
 * Exactly what a public match page may show: teams by name, scores, fouls,
 * where and when, and the match events. Never team contacts, notes, referee
 * ids or player details. Used by /api/fixtures/[id] and the live page.
 */
export const publicFixtureSelect = {
  id: true,
  status: true,
  phase: true,
  round: true,
  scheduledAt: true,
  homeScore: true,
  awayScore: true,
  homeFoulsH1: true,
  awayFoulsH1: true,
  homeFoulsH2: true,
  awayFoulsH2: true,
  homeTeamId: true,
  awayTeamId: true,
  homeTeam: { select: { id: true, name: true } },
  awayTeam: { select: { id: true, name: true } },
  competition: { select: { id: true, name: true } },
  pitch: { select: { name: true, venue: { select: { name: true } } } },
  events: {
    orderBy: { minute: "asc" },
    select: { id: true, type: true, minute: true, half: true, playerName: true, jerseyNumber: true, teamId: true, team: { select: { id: true, name: true } } },
  },
} satisfies Prisma.FixtureSelect;
