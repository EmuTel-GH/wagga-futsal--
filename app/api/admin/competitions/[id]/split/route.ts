import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getStandings } from "@/lib/standings";
import { distributeSlots, validateSplit } from "@/lib/split";

type Params = { params: Promise<{ id: string }> };

async function load(competitionId: string) {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      teams: { include: { team: { select: { id: true, name: true, status: true } } } },
      timeSlots: { include: { pitch: { select: { name: true } } } },
    },
  });
  if (!competition) return null;
  const [standings, unplayed, played] = await Promise.all([
    getStandings(competitionId),
    prisma.fixture.count({ where: { competitionId, status: { in: ["DRAFT", "SCHEDULED", "LIVE"] } } }),
    prisma.fixture.count({ where: { competitionId, status: { in: ["COMPLETED", "FORFEITED_HOME", "FORFEITED_AWAY", "ABANDONED"] } } }),
  ]);
  // Ladder order; teams that haven't played yet go last, alphabetically.
  const approved = competition.teams.filter((t) => t.team.status === "APPROVED").map((t) => t.team);
  const ranked = standings.filter((s) => approved.some((t) => t.id === s.teamId));
  const unranked = approved.filter((t) => !ranked.some((s) => s.teamId === t.id)).sort((a, b) => a.name.localeCompare(b.name));
  const ladder = [
    ...ranked.map((s, i) => ({ teamId: s.teamId, name: s.teamName, position: i + 1, played: s.played, points: s.points, goalDifference: s.goalDifference })),
    ...unranked.map((t) => ({ teamId: t.id, name: t.name, position: null, played: 0, points: 0, goalDifference: 0 })),
  ];
  const pending = competition.teams.filter((t) => t.team.status !== "APPROVED").map((t) => t.team.name);
  const slots = competition.timeSlots.map((s) => ({ id: s.id, dayOfWeek: s.dayOfWeek, startTime: s.startTime, pitchId: s.pitchId, pitchName: s.pitch.name, durationMins: s.durationMins }));
  return { competition, ladder, pending, slots, unplayed, played };
}

// Preview data for the split panel: ladder, slots, fixture counts.
export async function GET(_req: Request, { params }: Params) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const data = await load(id);
  if (!data) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  const { competition, ...rest } = data;
  return NextResponse.json({ competition: { id: competition.id, name: competition.name, status: competition.status }, ...rest });
}

// Split the competition into divisions: { divisions: [{ name, teamIds }] }.
// Creates the divisions (same season/age group/gender, linked via splitFrom),
// shares out the time slots, moves the teams plus their players' play-up/down
// approvals, unserved suspensions and competition-only breaks, deletes the
// unplayed fixtures and marks the original COMPLETED, so its results and
// ladder stay visible. Each division then needs its own (draft) draw.
export async function POST(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { divisions: raw } = await req.json();
  const data = await load(id);
  if (!data) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  const { competition, ladder, pending, slots } = data;

  if (competition.status === "COMPLETED") {
    return NextResponse.json({ error: "This competition is already completed." }, { status: 409 });
  }
  if (pending.length) {
    return NextResponse.json(
      { error: `Approve, merge or delete the pending nominations first: ${pending.join(", ")}.` },
      { status: 409 }
    );
  }
  if ((await prisma.fixture.count({ where: { competitionId: id, status: "LIVE" } })) > 0) {
    return NextResponse.json({ error: "A game in this competition is live right now — split it afterwards." }, { status: 409 });
  }
  const divisions: { name: string; teamIds: string[] }[] = Array.isArray(raw)
    ? raw.map((d: { name?: unknown; teamIds?: unknown }) => ({
        name: String(d?.name ?? "").trim().slice(0, 80),
        teamIds: Array.isArray(d?.teamIds) ? d.teamIds.map(String) : [],
      }))
    : [];
  const errors = validateSplit(divisions, ladder.map((t) => t.teamId));
  if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

  const { perDivision, clash } = distributeSlots(slots, divisions.length);
  const movedTeamIds = divisions.flatMap((d) => d.teamIds);

  const [rosters, dispensations, suspensions, compBreaks] = await Promise.all([
    prisma.teamPlayer.findMany({ where: { teamId: { in: movedTeamIds } }, select: { teamId: true, playerId: true } }),
    prisma.dispensation.findMany({ where: { competitionId: id } }),
    prisma.suspension.findMany({ where: { competitionId: id } }),
    prisma.fixtureBreak.findMany({ where: { competitionId: id } }),
  ]);
  // Which division(s) each player ends up in, via their team rosters.
  const divisionOfTeam = new Map(divisions.flatMap((d, i) => d.teamIds.map((t) => [t, i] as const)));
  const playerDivisions = new Map<string, Set<number>>();
  for (const r of rosters) {
    const set = playerDivisions.get(r.playerId) ?? new Set<number>();
    set.add(divisionOfTeam.get(r.teamId)!);
    playerDivisions.set(r.playerId, set);
  }
  const activeSuspensions = suspensions.filter((s) => s.fixturesServed < s.fixturesBanned);

  const created = await prisma.$transaction(async (tx) => {
    const unplayed = await tx.fixture.deleteMany({ where: { competitionId: id, status: { in: ["DRAFT", "SCHEDULED"] } } });
    await tx.competitionTeam.deleteMany({ where: { competitionId: id, teamId: { in: movedTeamIds } } });

    const made = [];
    for (const [i, d] of divisions.entries()) {
      const division = await tx.competition.create({
        data: {
          name: d.name,
          season: competition.season,
          ageGroup: competition.ageGroup,
          gender: competition.gender,
          status: "REGISTRATION", // goes ACTIVE when its draw is published
          splitFromId: id,
          teams: { create: d.teamIds.map((teamId) => ({ teamId })) },
          timeSlots: {
            create: perDivision[i].map((s) => ({ pitchId: s.pitchId, dayOfWeek: s.dayOfWeek, startTime: s.startTime, durationMins: s.durationMins })),
          },
        },
      });
      const inDivision = (playerId: string) => playerDivisions.get(playerId)?.has(i) ?? false;
      const disp = dispensations.filter((x) => inDivision(x.playerId));
      if (disp.length) {
        await tx.dispensation.createMany({
          data: disp.map((x) => ({ playerId: x.playerId, competitionId: division.id, type: x.type, approvedBy: x.approvedBy, note: x.note })),
        });
      }
      const susp = activeSuspensions.filter((x) => inDivision(x.playerId));
      if (susp.length) {
        await tx.suspension.createMany({
          data: susp.map((x) => ({
            playerId: x.playerId,
            competitionId: division.id,
            fixturesBanned: x.fixturesBanned - x.fixturesServed,
            fixturesServed: 0,
            reason: `${x.reason} (carried over from ${competition.name})`,
          })),
        });
      }
      if (compBreaks.length) {
        await tx.fixtureBreak.createMany({
          data: compBreaks.map((b) => ({ name: b.name, startDate: b.startDate, endDate: b.endDate, competitionId: division.id })),
        });
      }
      made.push({ id: division.id, name: division.name, teams: d.teamIds.length, slots: perDivision[i].length, dispensations: disp.length, suspensions: susp.length });
    }
    await tx.competition.update({ where: { id }, data: { status: "COMPLETED" } });
    return { made, unplayedDeleted: unplayed.count };
  });

  const teamName = new Map(ladder.map((t) => [t.teamId, t.name]));
  await audit(session, {
    action: "competition.split",
    summary: `Split ${competition.name} into ${divisions.map((d) => `${d.name} (${d.teamIds.length} teams)`).join(", ")}; ${created.unplayedDeleted} unplayed fixtures removed`,
    entityType: "Competition",
    entityId: id,
    details: {
      divisions: divisions.map((d, i) => ({ ...created.made[i], teams: d.teamIds.map((t) => teamName.get(t)) })),
      unplayedDeleted: created.unplayedDeleted,
      slotClash: clash,
    },
  });

  return NextResponse.json({ divisions: created.made, unplayedDeleted: created.unplayedDeleted, slotClash: clash });
}
