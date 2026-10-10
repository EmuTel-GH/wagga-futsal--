import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { validateRates } from "@/lib/payRates";
import { audit } from "@/lib/audit";
import { generateABA, ABAError } from "@/lib/aba";
import { maskBank, openBank } from "@/lib/bankDetails";

// Two referee rate tiers: senior games (U16 & Opens — incl. U19/Social) and
// junior games (everything else).
const SENIOR_GROUPS = ["U16", "U19", "OPENS", "SOCIAL"];
const isSenior = (ageGroup: string) => SENIOR_GROUPS.includes(ageGroup);

export async function GET(req: Request) {
  try { await requirePermission("MANAGE_PAYROLL"); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to required" }, { status: 400 });

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setUTCHours(23, 59, 59, 999);

  const [rate, referees, fixtures] = await Promise.all([
    prisma.payRate.findFirst(),
    prisma.referee.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.fixture.findMany({
      where: {
        status: "COMPLETED",
        scheduledAt: { gte: fromDate, lte: toDate },
        OR: [{ fieldRefereeId: { not: null } }, { scorerId: { not: null } }],
      },
      select: { fieldRefereeId: true, scorerId: true, scheduledAt: true, competition: { select: { ageGroup: true } } },
    }),
  ]);

  const rates = {
    fieldJr: rate?.fieldRefCents ?? 5000,
    scorerJr: rate?.scorerCents ?? 2500,
    fieldSr: rate?.fieldRefSeniorCents ?? 5000,
    scorerSr: rate?.scorerSeniorCents ?? 2500,
  };

  const summary = referees.map((ref) => {
    const fieldSr = fixtures.filter((f) => f.fieldRefereeId === ref.id && isSenior(f.competition.ageGroup)).length;
    const fieldJr = fixtures.filter((f) => f.fieldRefereeId === ref.id && !isSenior(f.competition.ageGroup)).length;
    const scorerSr = fixtures.filter((f) => f.scorerId === ref.id && isSenior(f.competition.ageGroup)).length;
    const scorerJr = fixtures.filter((f) => f.scorerId === ref.id && !isSenior(f.competition.ageGroup)).length;
    const totalCents =
      fieldSr * rates.fieldSr + fieldJr * rates.fieldJr + scorerSr * rates.scorerSr + scorerJr * rates.scorerJr;
    return {
      refereeId: ref.id,
      name: ref.user?.name ?? [ref.firstName, ref.lastName].filter(Boolean).join(" ") ?? "Unnamed referee",
      email: ref.user?.email ?? null,
      // Masked: the full numbers only go into the ABA file (POST).
      ...maskBank(ref),
      fieldRefGames: fieldSr + fieldJr,
      scorerGames: scorerSr + scorerJr,
      seniorGames: fieldSr + scorerSr,
      juniorGames: fieldJr + scorerJr,
      totalCents,
    };
  }).filter((r) => r.totalCents > 0);

  return NextResponse.json({ summary, rate, fixtureCount: fixtures.length });
}

export async function POST(req: Request) {
  let session;
  try { session = await requirePermission("MANAGE_PAYROLL"); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { from, to, orgBsb, orgAccount, orgName, orgBank, orgApcaId } = body;
  if (!from || !to || !orgBsb || !orgAccount || !orgName || !orgBank || !orgApcaId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setUTCHours(23, 59, 59, 999);

  const [rate, referees, fixtures] = await Promise.all([
    prisma.payRate.findFirst(),
    prisma.referee.findMany({
      include: { user: { select: { name: true } } },
    }),
    prisma.fixture.findMany({
      where: {
        status: "COMPLETED",
        scheduledAt: { gte: fromDate, lte: toDate },
        OR: [{ fieldRefereeId: { not: null } }, { scorerId: { not: null } }],
      },
      select: { fieldRefereeId: true, scorerId: true, competition: { select: { ageGroup: true } } },
    }),
  ]);

  const rates = {
    fieldJr: rate?.fieldRefCents ?? 5000,
    scorerJr: rate?.scorerCents ?? 2500,
    fieldSr: rate?.fieldRefSeniorCents ?? 5000,
    scorerSr: rate?.scorerSeniorCents ?? 2500,
  };

  type Payee = { bsb: string; accountNumber: string; accountName: string; amountCents: number; reference: string };
  const payees: Payee[] = referees
    .flatMap((ref) => {
      const fieldSr = fixtures.filter((f) => f.fieldRefereeId === ref.id && isSenior(f.competition.ageGroup)).length;
      const fieldJr = fixtures.filter((f) => f.fieldRefereeId === ref.id && !isSenior(f.competition.ageGroup)).length;
      const scorerSr = fixtures.filter((f) => f.scorerId === ref.id && isSenior(f.competition.ageGroup)).length;
      const scorerJr = fixtures.filter((f) => f.scorerId === ref.id && !isSenior(f.competition.ageGroup)).length;
      const amountCents =
        fieldSr * rates.fieldSr + fieldJr * rates.fieldJr + scorerSr * rates.scorerSr + scorerJr * rates.scorerJr;
      if (!amountCents || !ref.bsb || !ref.accountNumber || !ref.accountName) return [];
      const bank = openBank(ref); // decrypted on the server, only into the file
      return [{ bsb: bank.bsb!, accountNumber: bank.accountNumber!, accountName: bank.accountName!, amountCents, reference: "WAGGA FUTSAL GAME FEE" }];
    });

  if (payees.length === 0) {
    return NextResponse.json({ error: "No payable referees with bank details in this period" }, { status: 400 });
  }

  // Build the file first: input the bank would reject is a 400, and isn't saved.
  let aba: string;
  try {
    aba = generateABA(payees, {
      bankMnemonic: orgBank,
      userName: orgName,
      userBsb: orgBsb,
      userAccount: orgAccount,
      apcaId: orgApcaId,
      description: "GAME FEES",
      processingDate: new Date(),
    });
  } catch (e) {
    if (e instanceof ABAError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  // Save org details to rate card for next time
  await prisma.payRate.upsert({
    where: { id: rate?.id ?? "default" },
    create: {
      id: "default",
      fieldRefCents: rate?.fieldRefCents ?? 5000,
      scorerCents: rate?.scorerCents ?? 2500,
      orgBsb, orgAccount, orgName, orgBank, orgApcaId,
    },
    update: { orgBsb, orgAccount, orgName, orgBank, orgApcaId },
  });

  const filename = `referee-pay-${from}-to-${to}.aba`;
  const totalCents = payees.reduce((s, p) => s + p.amountCents, 0);
  await audit(session, {
    action: "payroll.aba.export",
    summary: `Exported referee pay ABA file for ${from} to ${to}: ${payees.length} payees, $${(totalCents / 100).toFixed(2)}`,
    entityType: "PayRate",
    details: { from, to, payees: payees.length, totalCents, orgName, orgBank },
  });
  return new Response(aba, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function PATCH(req: Request) {
  let session;
  try { session = await requirePermission("MANAGE_PAYROLL"); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checked = validateRates(await req.json().catch(() => null));
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const { fieldRefCents, scorerCents, fieldRefSeniorCents, scorerSeniorCents } = checked.rates;

  const rate = await prisma.payRate.upsert({
    where: { id: "default" },
    create: { id: "default", ...checked.rates },
    update: checked.rates,
  });

  await audit(session, {
    action: "payroll.rates.update",
    summary: "Updated referee pay rates",
    entityType: "PayRate",
    entityId: rate.id,
    details: { fieldRefCents, scorerCents, fieldRefSeniorCents, scorerSeniorCents },
  });

  return NextResponse.json(rate);
}
