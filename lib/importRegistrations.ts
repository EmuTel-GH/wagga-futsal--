import { parse } from "papaparse";
import type { Gender, OfficialRole } from "@prisma/client";
import { prisma } from "./prisma";
import { defaultRegisteredGroup } from "./eligibility";

/**
 * PlayFootball registration import — THE way players, team officials and
 * referees are created. Handles the "AllRegistrations" export
 * (Participant name / FFA number / Date of Birth / Gender / Product name /
 * Registration status) and the older simple format
 * (FirstName / LastName / DateOfBirth / Gender / PlayFootballID).
 *
 * Product name determines what a row becomes:
 *   "... Player Junior/Senior ..."  → Player (senior → OPENS; junior's age
 *                                     group derived from DOB per rule 7.2)
 *   "... Coach ..." / "Manager ..." → TeamOfficial (assign to a team later)
 *   "... Referee ..."               → Referee (no login yet — link a User to
 *                                     give scoring-portal access)
 */

export interface ImportSummary {
  players: number;
  officials: number;
  referees: number;
  skipped: number;
  errors: string[];
}

function normaliseKeys(row: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase().replace(/[\s_-]/g, ""), (v ?? "").trim()])
  );
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

function parseGender(raw: string): Gender | null {
  const g = raw?.toLowerCase().trim();
  if (g === "female" || g === "f") return "FEMALE";
  if (g === "male" || g === "m") return "MALE";
  return null;
}

function parseDob(raw: string): Date | null {
  if (!raw) return null;
  // ISO (2013-07-12) parses directly; also accept dd/mm/yyyy.
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const d = dmy ? new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1])) : new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

type Classified =
  | { kind: "player"; senior: boolean }
  | { kind: "official"; role: OfficialRole }
  | { kind: "referee" }
  | { kind: "unknown" };

function classify(product: string): Classified {
  const p = product.toLowerCase();
  if (/referee/.test(p)) return { kind: "referee" };
  if (/coach/.test(p)) return { kind: "official", role: "COACH" };
  if (/manager/.test(p)) return { kind: "official", role: "MANAGER" };
  if (/player|free agent/.test(p) || p === "") {
    return { kind: "player", senior: /senior|open|social/.test(p) };
  }
  return { kind: "unknown" };
}

export async function importRegistrations(csvText: string): Promise<ImportSummary> {
  const { data, errors: parseErrs } = parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const summary: ImportSummary = { players: 0, officials: 0, referees: 0, skipped: 0, errors: [] };
  if (parseErrs.length > 0) {
    summary.errors.push(...parseErrs.slice(0, 5).map((e) => `CSV parse: ${e.message} (row ${e.row})`));
  }

  for (const raw of data) {
    const r = normaliseKeys(raw);

    const status = r["registrationstatus"] ?? "";
    if (/cancel|declin|withdraw/i.test(status)) {
      summary.skipped++;
      continue;
    }

    const name = r["participantname"]
      ? splitName(r["participantname"])
      : { firstName: r["firstname"] ?? r["first"] ?? "", lastName: r["lastname"] ?? r["surname"] ?? "" };
    const ffa = r["ffanumber"] || r["playfootballid"] || r["playerid"] || null;
    const dob = parseDob(r["dateofbirth"] || r["dob"] || "");
    const gender = parseGender(r["gender"] ?? r["sex"] ?? "");
    const label = `${name.firstName} ${name.lastName}`.trim() || "(unnamed row)";

    if (!name.firstName) {
      summary.errors.push(`Skipped row with no participant name: ${JSON.stringify(raw).slice(0, 120)}`);
      summary.skipped++;
      continue;
    }

    const what = classify(r["productname"] ?? r["product"] ?? r["role"] ?? "");

    try {
      if (what.kind === "unknown") {
        summary.errors.push(`${label}: unrecognised product "${r["productname"]}" — not imported.`);
        summary.skipped++;
      } else if (what.kind === "player") {
        if (!dob || !gender) {
          summary.errors.push(`${label}: player needs a valid DOB and gender — skipped.`);
          summary.skipped++;
          continue;
        }
        const registeredAgeGroup = what.senior ? "OPENS" : defaultRegisteredGroup(dob);
        if (!registeredAgeGroup) {
          summary.errors.push(`${label}: DOB ${dob.toISOString().slice(0, 10)} fits no age band (rule 1.1) — skipped.`);
          summary.skipped++;
          continue;
        }
        const values = { ...name, dateOfBirth: dob, gender, registeredAgeGroup };
        if (ffa) {
          await prisma.player.upsert({
            where: { playFootballId: ffa },
            update: values,
            create: { ...values, playFootballId: ffa },
          });
        } else {
          const existing = await prisma.player.findFirst({
            where: { firstName: name.firstName, lastName: name.lastName, dateOfBirth: dob },
          });
          if (existing) await prisma.player.update({ where: { id: existing.id }, data: values });
          else await prisma.player.create({ data: values });
        }
        summary.players++;
      } else if (what.kind === "official") {
        const values = { ...name, role: what.role };
        if (ffa) {
          await prisma.teamOfficial.upsert({
            where: { playFootballId: ffa },
            update: values,
            create: { ...values, playFootballId: ffa },
          });
        } else {
          const existing = await prisma.teamOfficial.findFirst({
            where: { firstName: name.firstName, lastName: name.lastName },
          });
          if (existing) await prisma.teamOfficial.update({ where: { id: existing.id }, data: values });
          else await prisma.teamOfficial.create({ data: values });
        }
        summary.officials++;
      } else {
        // Referee
        if (ffa) {
          await prisma.referee.upsert({
            where: { playFootballId: ffa },
            update: name,
            create: { ...name, playFootballId: ffa },
          });
        } else {
          const existing = await prisma.referee.findFirst({
            where: { firstName: name.firstName, lastName: name.lastName },
          });
          if (!existing) await prisma.referee.create({ data: name });
        }
        summary.referees++;
      }
    } catch (e) {
      summary.errors.push(`${label}: ${e instanceof Error ? e.message.split("\n")[0] : "import failed"}`);
      summary.skipped++;
    }
  }

  return summary;
}
