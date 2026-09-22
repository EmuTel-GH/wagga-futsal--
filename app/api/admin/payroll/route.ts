import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { generateABA } from "@/lib/aba";

export async function GET(req: Request) {
  try { await requireAdmin(); } catch {
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
      select: { fieldRefereeId: true, scorerId: true, scheduledAt: true },
    }),
  ]);

  const fieldRefRate = rate?.fieldRefCents ?? 5000;
  const scorerRate = rate?.scorerCents ?? 2500;

  const summary = referees.map((ref) => {
    const fieldRefGames = fixtures.filter((f) => f.fieldRefereeId === ref.id).length;
    const scorerGames = fixtures.filter((f) => f.scorerId === ref.id).length;
    const totalCents = fieldRefGames * fieldRefRate + scorerGames * scorerRate;
    return {
      refereeId: ref.id,
      name: ref.user?.name ?? [ref.firstName, ref.lastName].filter(Boolean).join(" ") ?? "Unnamed referee",
      email: ref.user?.email ?? null,
      bsb: ref.bsb,
      accountNumber: ref.accountNumber,
      accountName: ref.accountName,
      fieldRefGames,
      scorerGames,
      totalCents,
      hasBankDetails: !!(ref.bsb && ref.accountNumber && ref.accountName),
    };
  }).filter((r) => r.totalCents > 0);

  return NextResponse.json({ summary, rate, fixtureCount: fixtures.length });
}

export async function POST(req: Request) {
  try { await requireAdmin(); } catch {
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
      select: { fieldRefereeId: true, scorerId: true },
    }),
  ]);

  const fieldRefRate = rate?.fieldRefCents ?? 5000;
  const scorerRate = rate?.scorerCents ?? 2500;

  type Payee = { bsb: string; accountNumber: string; accountName: string; amountCents: number; reference: string };
  const payees: Payee[] = referees
    .flatMap((ref) => {
      const fieldRefGames = fixtures.filter((f) => f.fieldRefereeId === ref.id).length;
      const scorerGames = fixtures.filter((f) => f.scorerId === ref.id).length;
      const amountCents = fieldRefGames * fieldRefRate + scorerGames * scorerRate;
      if (!amountCents || !ref.bsb || !ref.accountNumber || !ref.accountName) return [];
      return [{ bsb: ref.bsb, accountNumber: ref.accountNumber, accountName: ref.accountName, amountCents, reference: "WAGGA FUTSAL GAME FEE" }];
    });

  if (payees.length === 0) {
    return NextResponse.json({ error: "No payable referees with bank details in this period" }, { status: 400 });
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

  const aba = generateABA(payees, {
    bankMnemonic: orgBank,
    userName: orgName,
    userBsb: orgBsb,
    userAccount: orgAccount,
    apcaId: orgApcaId,
    description: "GAME FEES",
    processingDate: new Date(),
  });

  const filename = `referee-pay-${from}-to-${to}.aba`;
  return new Response(aba, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function PATCH(req: Request) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fieldRefCents, scorerCents } = await req.json();

  const rate = await prisma.payRate.upsert({
    where: { id: "default" },
    create: { id: "default", fieldRefCents, scorerCents },
    update: { fieldRefCents, scorerCents },
  });

  return NextResponse.json(rate);
}
