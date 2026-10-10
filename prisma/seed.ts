import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // The seed creates demo logins with known passwords: never on a real site.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: NODE_ENV is production (the seed creates demo accounts with known passwords)");
  }
  console.log("🌱 Seeding Wagga Futsal...");

  // ─── Venue & Pitches ─────────────────────────────────────────────────────────
  const venue = await prisma.venue.upsert({
    where: { id: "venue-main" },
    update: {},
    create: {
      id: "venue-main",
      name: "Wagga Wagga Indoor Sports Centre",
      address: "Glenfield Road, Wagga Wagga NSW 2650",
      pitches: {
        create: [
          { id: "pitch-1", name: "Court 1" },
          { id: "pitch-2", name: "Court 2" },
          { id: "pitch-3", name: "Court 3" },
        ],
      },
    },
  });
  console.log(`✓ Venue: ${venue.name}`);

  // ─── Admin user ───────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@waggafutsal.com.au" },
    update: {},
    create: {
      email: "admin@waggafutsal.com.au",
      passwordHash: adminHash,
      name: "Samuel Gray",
      role: "ADMIN",
    },
  });
  console.log(`✓ Admin: ${admin.email}`);

  // ─── Referee users ────────────────────────────────────────────────────────────
  const refHash = await bcrypt.hash("referee123", 12);
  const ref1User = await prisma.user.upsert({
    where: { email: "ref1@waggafutsal.com.au" },
    update: {},
    create: {
      email: "ref1@waggafutsal.com.au",
      passwordHash: refHash,
      name: "Jake Thompson",
      role: "REFEREE",
      referee: { create: { phone: "0412 345 678" } },
    },
    include: { referee: true },
  });
  const ref2User = await prisma.user.upsert({
    where: { email: "ref2@waggafutsal.com.au" },
    update: {},
    create: {
      email: "ref2@waggafutsal.com.au",
      passwordHash: refHash,
      name: "Mia Collins",
      role: "REFEREE",
      referee: { create: { phone: "0413 456 789" } },
    },
    include: { referee: true },
  });
  console.log(`✓ Referees: ${ref1User.name}, ${ref2User.name}`);

  // ─── Players ─────────────────────────────────────────────────────────────────
  const playerData = [
    { firstName: "Liam", lastName: "Wilson", dob: "2000-03-15", gender: "MALE" },
    { firstName: "Noah", lastName: "Johnson", dob: "1999-07-22", gender: "MALE" },
    { firstName: "Oliver", lastName: "Brown", dob: "2001-11-08", gender: "MALE" },
    { firstName: "James", lastName: "Smith", dob: "1998-05-30", gender: "MALE" },
    { firstName: "William", lastName: "Davis", dob: "2002-01-14", gender: "MALE" },
    { firstName: "Ethan", lastName: "Miller", dob: "2000-09-03", gender: "MALE" },
    { firstName: "Lucas", lastName: "Moore", dob: "1999-12-19", gender: "MALE" },
    { firstName: "Mason", lastName: "Taylor", dob: "2001-06-27", gender: "MALE" },
    { firstName: "Logan", lastName: "Anderson", dob: "1998-02-11", gender: "MALE" },
    { firstName: "Alexander", lastName: "Thomas", dob: "2002-08-05", gender: "MALE" },
    { firstName: "Sophia", lastName: "Jackson", dob: "2000-04-18", gender: "FEMALE" },
    { firstName: "Emma", lastName: "White", dob: "1999-10-24", gender: "FEMALE" },
    { firstName: "Ava", lastName: "Harris", dob: "2001-03-07", gender: "FEMALE" },
    { firstName: "Isabella", lastName: "Martin", dob: "1998-07-31", gender: "FEMALE" },
    { firstName: "Mia", lastName: "Garcia", dob: "2002-11-16", gender: "FEMALE" },
    { firstName: "Charlotte", lastName: "Martinez", dob: "2000-06-02", gender: "FEMALE" },
    { firstName: "Amelia", lastName: "Robinson", dob: "1999-01-28", gender: "FEMALE" },
    { firstName: "Harper", lastName: "Clark", dob: "2001-09-12", gender: "FEMALE" },
    { firstName: "Evelyn", lastName: "Rodriguez", dob: "1998-04-23", gender: "FEMALE" },
    { firstName: "Abigail", lastName: "Lewis", dob: "2002-07-09", gender: "FEMALE" },
    // Extra players for 4 teams of 5
    { firstName: "Jack", lastName: "Lee", dob: "2000-02-17", gender: "MALE" },
    { firstName: "Henry", lastName: "Walker", dob: "1999-08-04", gender: "MALE" },
    { firstName: "Sebastian", lastName: "Hall", dob: "2001-05-21", gender: "MALE" },
    { firstName: "Aiden", lastName: "Allen", dob: "1998-11-13", gender: "MALE" },
    { firstName: "Owen", lastName: "Young", dob: "2002-03-29", gender: "MALE" },
    { firstName: "Carter", lastName: "Hernandez", dob: "2000-10-06", gender: "MALE" },
    { firstName: "Wyatt", lastName: "King", dob: "1999-06-14", gender: "MALE" },
    { firstName: "Daniel", lastName: "Wright", dob: "2001-01-30", gender: "MALE" },
    { firstName: "Ryan", lastName: "Lopez", dob: "1998-09-17", gender: "MALE" },
    { firstName: "Leo", lastName: "Hill", dob: "2002-04-08", gender: "MALE" },
  ];

  const players = await Promise.all(
    playerData.map((p) =>
      prisma.player.upsert({
        where: { playFootballId: `PF-${p.firstName}-${p.lastName}` },
        update: {},
        create: {
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: new Date(p.dob),
          gender: p.gender as "MALE" | "FEMALE",
          playFootballId: `PF-${p.firstName}-${p.lastName}`,
        },
      })
    )
  );
  console.log(`✓ ${players.length} players`);

  // ─── Teams ────────────────────────────────────────────────────────────────────
  const teamDefs = [
    { id: "team-1", name: "Wagga Thunder", email: "thunder@example.com" },
    { id: "team-2", name: "Riverina United", email: "united@example.com" },
    { id: "team-3", name: "Murrumbidgee FC", email: "murrumbidgee@example.com" },
    { id: "team-4", name: "Southern Storm", email: "storm@example.com" },
    { id: "team-5", name: "Wagga Warriors", email: "warriors@example.com" },
    { id: "team-6", name: "Capital City FC", email: "capital@example.com" },
  ];

  const teams = await Promise.all(
    teamDefs.map((t) =>
      prisma.team.upsert({
        where: { id: t.id },
        update: {},
        create: { id: t.id, name: t.name, contactEmail: t.email },
      })
    )
  );
  console.log(`✓ ${teams.length} teams`);

  // Assign players to teams (5 per team for 6 teams = 30 players)
  for (let t = 0; t < 6; t++) {
    const teamPlayers = players.slice(t * 5, t * 5 + 5);
    for (let p = 0; p < teamPlayers.length; p++) {
      await prisma.teamPlayer.upsert({
        where: { teamId_playerId: { teamId: teams[t].id, playerId: teamPlayers[p].id } },
        update: {},
        create: { teamId: teams[t].id, playerId: teamPlayers[p].id, jerseyNumber: p + 1 },
      });
    }
  }
  console.log("✓ Players assigned to teams");

  // ─── Competition ──────────────────────────────────────────────────────────────
  const comp = await prisma.competition.upsert({
    where: { id: "comp-opens-2025" },
    update: {},
    create: {
      id: "comp-opens-2025",
      name: "Opens Competition",
      season: "2025-W1",
      ageGroup: "OPENS",
      gender: "MIXED",
      status: "ACTIVE",
      timeSlots: {
        create: [
          { pitchId: "pitch-1", dayOfWeek: 3, startTime: "18:00", durationMins: 40 },
          { pitchId: "pitch-2", dayOfWeek: 3, startTime: "18:00", durationMins: 40 },
          { pitchId: "pitch-1", dayOfWeek: 3, startTime: "19:00", durationMins: 40 },
          { pitchId: "pitch-2", dayOfWeek: 3, startTime: "19:00", durationMins: 40 },
        ],
      },
    },
  });

  // Enrol all 6 teams
  for (const team of teams) {
    await prisma.competitionTeam.upsert({
      where: { competitionId_teamId: { competitionId: comp.id, teamId: team.id } },
      update: {},
      create: { competitionId: comp.id, teamId: team.id },
    });
  }
  console.log(`✓ Competition: ${comp.name} with ${teams.length} teams`);

  // ─── Fixtures (round-robin: 15 rounds, sample first 6 fixtures seeded) ───────
  const fixtureData = [
    // Round 1
    { home: "team-1", away: "team-6", round: 1, pitch: "pitch-1", scheduledAt: new Date("2025-07-16T18:00:00+10:00"), status: "COMPLETED", homeScore: 5, awayScore: 3 },
    { home: "team-2", away: "team-5", round: 1, pitch: "pitch-2", scheduledAt: new Date("2025-07-16T18:00:00+10:00"), status: "COMPLETED", homeScore: 2, awayScore: 4 },
    { home: "team-3", away: "team-4", round: 1, pitch: "pitch-1", scheduledAt: new Date("2025-07-16T19:00:00+10:00"), status: "COMPLETED", homeScore: 3, awayScore: 3 },
    // Round 2
    { home: "team-1", away: "team-5", round: 2, pitch: "pitch-2", scheduledAt: new Date("2025-07-23T18:00:00+10:00"), status: "COMPLETED", homeScore: 4, awayScore: 2 },
    { home: "team-2", away: "team-4", round: 2, pitch: "pitch-1", scheduledAt: new Date("2025-07-23T18:00:00+10:00"), status: "COMPLETED", homeScore: 6, awayScore: 1 },
    { home: "team-3", away: "team-6", round: 2, pitch: "pitch-2", scheduledAt: new Date("2025-07-23T19:00:00+10:00"), status: "COMPLETED", homeScore: 0, awayScore: 2 },
    // Round 3
    { home: "team-1", away: "team-4", round: 3, pitch: "pitch-1", scheduledAt: new Date("2025-07-30T18:00:00+10:00"), status: "COMPLETED", homeScore: 3, awayScore: 1 },
    { home: "team-2", away: "team-6", round: 3, pitch: "pitch-2", scheduledAt: new Date("2025-07-30T18:00:00+10:00"), status: "COMPLETED", homeScore: 2, awayScore: 2 },
    { home: "team-5", away: "team-3", round: 3, pitch: "pitch-1", scheduledAt: new Date("2025-07-30T19:00:00+10:00"), status: "COMPLETED", homeScore: 4, awayScore: 0 },
    // Round 4 — upcoming
    { home: "team-1", away: "team-3", round: 4, pitch: "pitch-1", scheduledAt: new Date("2025-08-06T18:00:00+10:00"), status: "SCHEDULED", homeScore: 0, awayScore: 0 },
    { home: "team-4", away: "team-6", round: 4, pitch: "pitch-2", scheduledAt: new Date("2025-08-06T18:00:00+10:00"), status: "SCHEDULED", homeScore: 0, awayScore: 0 },
    { home: "team-2", away: "team-5", round: 4, pitch: "pitch-1", scheduledAt: new Date("2025-08-06T19:00:00+10:00"), status: "SCHEDULED", homeScore: 0, awayScore: 0 },
  ];

  for (const f of fixtureData) {
    await prisma.fixture.upsert({
      where: {
        id: `fix-${f.round}-${f.home}-${f.away}`,
      },
      update: {},
      create: {
        id: `fix-${f.round}-${f.home}-${f.away}`,
        competitionId: comp.id,
        homeTeamId: f.home,
        awayTeamId: f.away,
        pitchId: f.pitch,
        round: f.round,
        scheduledAt: f.scheduledAt,
        status: f.status as "SCHEDULED" | "COMPLETED",
        homeScore: f.homeScore,
        awayScore: f.awayScore,
        fieldRefereeId: ref1User.referee?.id ?? null,
        scorerId: ref2User.referee?.id ?? null,
      },
    });
  }
  console.log(`✓ ${fixtureData.length} fixtures`);

  // ─── Match events for completed games ─────────────────────────────────────────
  const events = [
    // R1: Thunder 5 – 3 Capital (pitch-1)
    { fixture: "fix-1-team-1-team-6", team: "team-1", type: "GOAL", minute: 4, half: 1, name: "Liam Wilson", jersey: 1 },
    { fixture: "fix-1-team-1-team-6", team: "team-6", type: "GOAL", minute: 8, half: 1, name: "Carter Hernandez", jersey: 1 },
    { fixture: "fix-1-team-1-team-6", team: "team-1", type: "GOAL", minute: 12, half: 1, name: "Noah Johnson", jersey: 2 },
    { fixture: "fix-1-team-1-team-6", team: "team-1", type: "GOAL", minute: 17, half: 1, name: "Liam Wilson", jersey: 1 },
    { fixture: "fix-1-team-1-team-6", team: "team-6", type: "GOAL", minute: 19, half: 1, name: "Wyatt King", jersey: 2 },
    { fixture: "fix-1-team-1-team-6", team: "team-1", type: "YELLOW_CARD", minute: 22, half: 2, name: "James Smith", jersey: 4 },
    { fixture: "fix-1-team-1-team-6", team: "team-1", type: "GOAL", minute: 25, half: 2, name: "Oliver Brown", jersey: 3 },
    { fixture: "fix-1-team-1-team-6", team: "team-6", type: "GOAL", minute: 28, half: 2, name: "Carter Hernandez", jersey: 1 },
    { fixture: "fix-1-team-1-team-6", team: "team-1", type: "GOAL", minute: 35, half: 2, name: "Noah Johnson", jersey: 2 },
    // R1: United 2 – 4 Warriors
    { fixture: "fix-1-team-2-team-5", team: "team-5", type: "GOAL", minute: 6, half: 1, name: "Alexander Thomas", jersey: 5 },
    { fixture: "fix-1-team-2-team-5", team: "team-2", type: "GOAL", minute: 11, half: 1, name: "Sophia Jackson", jersey: 1 },
    { fixture: "fix-1-team-2-team-5", team: "team-5", type: "GOAL", minute: 16, half: 1, name: "Logan Anderson", jersey: 4 },
    { fixture: "fix-1-team-2-team-5", team: "team-5", type: "GOAL", minute: 23, half: 2, name: "Alexander Thomas", jersey: 5 },
    { fixture: "fix-1-team-2-team-5", team: "team-2", type: "GOAL", minute: 29, half: 2, name: "Emma White", jersey: 2 },
    { fixture: "fix-1-team-2-team-5", team: "team-5", type: "GOAL", minute: 37, half: 2, name: "Logan Anderson", jersey: 4 },
  ];

  for (const e of events) {
    await prisma.matchEvent.create({
      data: {
        fixtureId: e.fixture,
        teamId: e.team,
        type: e.type as "GOAL" | "YELLOW_CARD" | "RED_CARD" | "FOUL",
        minute: e.minute,
        half: e.half,
        playerName: e.name,
        jerseyNumber: e.jersey,
      },
    });
  }
  console.log(`✓ ${events.length} match events`);

  // ─── Sponsors ─────────────────────────────────────────────────────────────────
  const sponsors = [
    { name: "Wagga Wagga City Council", tier: "PLATINUM", website: "https://www.wagga.nsw.gov.au", sortOrder: 1, active: true },
    { name: "Riverina Toyota", tier: "GOLD", website: "https://www.riverina.toyota.com.au", sortOrder: 2, active: true },
    { name: "Sturt Mall", tier: "GOLD", website: "https://www.sturtmall.com.au", sortOrder: 3, active: true },
    { name: "Wagga Wagga Printing", tier: "SILVER", website: null, sortOrder: 4, active: true },
    { name: "Murrumbidgee Irrigation", tier: "SILVER", website: null, sortOrder: 5, active: true },
    { name: "Byrnes Lawyers", tier: "BRONZE", website: null, sortOrder: 6, active: true },
    { name: "Southcity Physio", tier: "BRONZE", website: null, sortOrder: 7, active: true },
  ];

  for (const s of sponsors) {
    await prisma.sponsor.create({
      data: { ...s, tier: s.tier as "PLATINUM" | "GOLD" | "SILVER" | "BRONZE", website: s.website ?? null },
    });
  }
  console.log(`✓ ${sponsors.length} sponsors`);

  // ─── Futsal Session ───────────────────────────────────────────────────────────
  await prisma.futsalSession.upsert({
    where: { id: "session-aug-2025" },
    update: {},
    create: {
      id: "session-aug-2025",
      title: "Saturday Social Futsal",
      description: "All welcome — bring your boots and a mate! 5-a-side games throughout the morning.",
      scheduledAt: new Date("2025-08-09T09:00:00+10:00"),
      durationMins: 120,
      capacityMax: 30,
      priceCents: 1500,
      status: "OPEN",
    },
  });
  console.log("✓ Futsal session");

  // ─── Rules Document ───────────────────────────────────────────────────────────
  await prisma.rulesDocument.upsert({
    where: { id: "rules-v1" },
    update: {},
    create: {
      id: "rules-v1",
      title: "Wagga Futsal Competition Rules",
      version: "1.1",
      active: true,
      publishedAt: new Date("2025-01-01"),
      content: `# Wagga Futsal Competition Rules 2025–2026

## 1. General
1.1 All players must be registered via PlayFootball prior to participating.
1.2 Teams must have a minimum of 4 players to start a match.
1.3 Matches consist of two 20-minute halves with a 5-minute half-time break.

## 2. Player Equipment
2.1 Futsal shoes or flat-soled shoes only — no moulded studs.
2.2 Shin guards are strongly recommended.
2.3 Goalkeepers must wear a distinguishing colour.

## 3. Fouls & Misconduct
3.1 Accumulated fouls: if a team accumulates 5 fouls in a half, the opposing team is awarded a direct free kick from the second penalty mark (10m) for each subsequent foul.
3.2 Yellow card — player is cautioned and suspended for 2 minutes. Team plays short.
3.3 Red card — player is sent off for the remainder of the match and suspended for the next match minimum.

## 4. Scoring & Results
4.1 Win = 3 points, Draw = 1 point, Loss = 0 points.
4.2 Tiebreakers: goal difference, then goals scored, then head-to-head.
4.3 A forfeited match is recorded as 5–0 to the non-forfeiting team.

## 5. Finals
5.1 Top 4 teams at the end of the regular season qualify for finals.
5.2 Semi-final 1: 1st vs 4th. Semi-final 2: 2nd vs 3rd.
5.3 Grand Final: SF1 winner vs SF2 winner.
5.4 Finals matches that are drawn after full time go to a 3-minute golden goal period, then penalty shootout.

## 6. Code of Conduct
6.1 Respect all players, referees, and officials at all times.
6.2 Abusive language or behaviour will result in immediate dismissal.
6.3 Repeated misconduct may result in suspension from the competition.`,
    },
  });
  console.log("✓ Rules document");

  console.log("\n✅ Seed complete!\n");
  console.log("Admin login:    admin@waggafutsal.com.au  /  admin123");
  console.log("Referee login:  ref1@waggafutsal.com.au   /  referee123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
