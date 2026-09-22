/**
 * One-off: remove seeded demo data before the real Summer 2026 season.
 *
 * DELETES: match events, fixtures, suspensions, dispensations, team-player
 * links, teams, players, competitions + time slots, demo referee logins
 * (ref1/ref2@waggafutsal.com.au) and all auth sessions (everyone re-logs-in).
 *
 * KEEPS: admin user, rules document, venue + pitches, sponsors, bookable
 * sessions + bookings, pay rates. (Sponsors/sessions handled separately.)
 *
 * Usage: DATABASE_URL=... npx tsx prisma/wipe-demo.ts
 */
import { prisma } from "../lib/prisma";

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const matchEvents = await tx.matchEvent.deleteMany();
    const suspensions = await tx.suspension.deleteMany();
    const fixtures = await tx.fixture.deleteMany();
    const dispensations = await tx.dispensation.deleteMany();
    const teamPlayers = await tx.teamPlayer.deleteMany();
    const competitionTeams = await tx.competitionTeam.deleteMany();
    const timeSlots = await tx.competitionTimeSlot.deleteMany();
    const teams = await tx.team.deleteMany();
    const players = await tx.player.deleteMany();
    const competitions = await tx.competition.deleteMany();
    const referees = await tx.referee.deleteMany();
    const demoRefUsers = await tx.user.deleteMany({
      where: { role: "REFEREE", email: { in: ["ref1@waggafutsal.com.au", "ref2@waggafutsal.com.au"] } },
    });
    const authSessions = await tx.authSession.deleteMany();
    return {
      matchEvents: matchEvents.count,
      suspensions: suspensions.count,
      fixtures: fixtures.count,
      dispensations: dispensations.count,
      teamPlayers: teamPlayers.count,
      competitionTeams: competitionTeams.count,
      timeSlots: timeSlots.count,
      teams: teams.count,
      players: players.count,
      competitions: competitions.count,
      referees: referees.count,
      demoRefUsers: demoRefUsers.count,
      authSessions: authSessions.count,
    };
  });
  console.table(result);
}

main().finally(() => prisma.$disconnect());
