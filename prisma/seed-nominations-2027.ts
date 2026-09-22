/**
 * One-off: create the Summer 2026/27 competitions and team nominations from
 * "2026-2027 Nominations and Free Agents.xlsx" (sheet "2027 teams").
 *
 * Team entries are imported verbatim ("Team Name - Contact" split into name +
 * contactName; a bare person's name means the team is unnamed so far — rename
 * in Admin → Teams). Free agents are NOT imported here: they're simply players
 * with no team yet (see Admin → Players → "Unassigned only").
 *
 * Safe to re-run: skips competitions/teams that already exist by name.
 *
 * Usage: DATABASE_URL=... npx tsx prisma/seed-nominations-2027.ts
 */
import type { AgeGroup } from "@prisma/client";
import { prisma } from "../lib/prisma";

const SEASON = "Summer 2026/27";

type Nom = { name: string; contact?: string };

const tc = (s: string) =>
  s.replace(/\S+/g, (w) => (w === w.toUpperCase() && w.length > 2 ? w[0] + w.slice(1).toLowerCase() : w));

const COMPETITIONS: { name: string; ageGroup: AgeGroup; teams: Nom[] }[] = [
  { name: "U8 Mixed", ageGroup: "U8", teams: [] }, // no team nominations yet — individual rego only
  {
    name: "U10 Division 1",
    ageGroup: "U10",
    teams: [
      { name: "Yoda United" },
      { name: "Thunder Cats", contact: "Elmein Bruce" },
      { name: "Pocket Rockets", contact: "Alphonse Joy" },
      { name: "Kangaroos", contact: tc("NEIL BROWN") },
      { name: "Skillers", contact: "Peter Flew" },
      { name: "Crowing Emus" },
      { name: "Thunder", contact: "Nick Forsyth" },
    ],
  },
  {
    name: "U10 Division 2",
    ageGroup: "U10",
    teams: [
      { name: "Goal Getters", contact: "Kate Long" },
      { name: "L.A Gators" },
      { name: "Whirlwinds" },
      { name: "Goalzillas", contact: tc("EMMA HENRY") },
      { name: "Mini Nutmegs", contact: "Tess Flinn" },
      { name: "Emma Whyte", contact: "Emma Whyte" }, // team unnamed — nominated by Emma Whyte
      { name: "Pioneer Shooters", contact: "Stephen Gilmour" },
      { name: "Falcons", contact: "Elle Pearson" },
    ],
  },
  {
    name: "U12 Division 1",
    ageGroup: "U12",
    teams: [
      { name: "Crowing Emu's", contact: tc("ANDY HELLER") },
      { name: "Cheeky Chipmunks", contact: "Adam Hill" },
      { name: "Vikings", contact: "Neil Brown" },
      { name: "Battlebots" },
      { name: "Brave Hearts", contact: "Alphonse Joy" },
      { name: "Bonito Blues", contact: "Nathan Carroll" },
      { name: "Hot Tacos (Great White Sharks)", contact: "David McGowan" },
    ],
  },
  {
    name: "U12 Division 2",
    ageGroup: "U12",
    teams: [
      { name: "Mini Nutmegs", contact: "Tess Flinn" },
      { name: "Whirlwinds", contact: tc("ALEXIS NEYLAN") },
      { name: "Goal Getters", contact: tc("KATE LONG") },
      { name: "Skillers", contact: tc("PETER FLEW") },
      { name: "Kim Baker", contact: "Kim Baker" }, // team unnamed — nominated by Kim Baker
      { name: "Coolamon Girls", contact: "Jane Robertson" },
    ],
  },
  {
    name: "U14 Mixed",
    ageGroup: "U14",
    teams: [
      { name: "Nutmegs", contact: "Tess Flinn" },
      { name: "The Dribblers", contact: "David McGowan" },
      { name: "GYG Burrito Boys", contact: "Gaby Silver" },
      { name: "Kicking and Screaming", contact: "Kate Long" },
      { name: "BattleBots", contact: "Sam Robins" },
      { name: "Thunder", contact: "Jodie Mitchell" },
      { name: "Rona Rangers", contact: "Greg Doran" },
      { name: "BM Ag Goal Diggers", contact: "Lauren Harris" },
      { name: "A&A Strikers", contact: "Cassie Knox-Niven" },
    ],
  },
  {
    name: "U16 Mixed",
    ageGroup: "U16",
    teams: [
      { name: "Nutmegs", contact: "Tess Flinn" },
      { name: "Joga Bonito", contact: "Lincoln Carey" },
      { name: "Until It's Done", contact: "Chris Ayton" },
      { name: "Terminators", contact: tc("KATE PLUM") },
      { name: "Bonito Nation", contact: "Nathan Carroll" },
      { name: "Blitz FC (It Just Got Messi)", contact: "Joel Lowrie" },
      { name: "Average Joes", contact: "Daryl Mitchell" },
      { name: "Girls Are Ready", contact: "Kristylee Bowditch" },
      { name: "Tara Walker", contact: "Tara Walker" }, // team unnamed
      { name: "Nafin Kambar", contact: "Nafin Kambar" }, // team unnamed
    ],
  },
  {
    name: "Opens",
    ageGroup: "OPENS",
    teams: [
      { name: "EasyBeats", contact: "Chris Ayton" },
      { name: "Howdy Gang", contact: "Caelan Gray" },
      { name: "Occasionally United", contact: "Brett Scammell" },
      { name: "Kooringal Cure", contact: "Neil Brown" },
      { name: "Adrian Jones", contact: "Adrian Jones" }, // team unnamed
      { name: "STARTTS" },
    ],
  },
];

async function main() {
  let comps = 0;
  let teams = 0;

  for (const comp of COMPETITIONS) {
    let competition = await prisma.competition.findFirst({ where: { name: comp.name, season: SEASON } });
    if (!competition) {
      competition = await prisma.competition.create({
        data: { name: comp.name, season: SEASON, ageGroup: comp.ageGroup, gender: "MIXED", status: "REGISTRATION" },
      });
      comps++;
    }

    for (const nom of comp.teams) {
      // Team names repeat across age groups (e.g. two "Mini Nutmegs") — scope
      // the duplicate check to this competition.
      const already = await prisma.competitionTeam.findFirst({
        where: { competitionId: competition.id, team: { name: nom.name } },
      });
      if (already) continue;

      const team = await prisma.team.create({
        data: { name: nom.name, contactName: nom.contact ?? null },
      });
      await prisma.competitionTeam.create({ data: { teamId: team.id, competitionId: competition.id } });
      teams++;
    }
    console.log(`✓ ${comp.name}: ${comp.teams.length} nominations`);
  }

  console.log(`\nDone — ${comps} competitions created, ${teams} teams nominated.`);
}

main().finally(() => prisma.$disconnect());
