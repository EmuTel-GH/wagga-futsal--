import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requirePermission, hasPermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { maskBank, sealBank } from "@/lib/bankDetails";

type Params = { params: Promise<{ id: string }> };

// Set (or { clear: true } remove) a referee's bank details. They're encrypted
// before saving and only ever returned masked. Needs MANAGE_PAYROLL, since
// the ABA pay file pays into these accounts.
export async function PATCH(req: Request, { params }: Params) {
  let session;
  try {
    session = await requirePermission("MANAGE_PAYROLL");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  let data: { bsb: string | null; accountNumber: string | null; accountName: string | null };
  if (body.clear === true) {
    data = { bsb: null, accountNumber: null, accountName: null };
  } else {
    let sealed;
    try {
      sealed = sealBank(body, id);
    } catch {
      return NextResponse.json({ error: "Bank details can't be saved right now (encryption isn't configured). Contact support." }, { status: 500 });
    }
    if ("error" in sealed) return NextResponse.json({ error: sealed.error }, { status: 400 });
    data = sealed.data;
  }

  const referee = await prisma.referee.update({
    where: { id },
    data,
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  await audit(session, {
    action: body.clear === true ? "referee.bank_details.clear" : "referee.bank_details.update",
    summary: `${body.clear === true ? "Removed" : "Updated"} bank details for ${referee.user?.name ?? ([referee.firstName, referee.lastName].filter(Boolean).join(" ") || "referee")}`,
    entityType: "Referee",
    entityId: id,
    details: { bsb: body.bsb, accountNumber: body.accountNumber, accountName: body.accountName },
  });

  return NextResponse.json({ ...referee, ...maskBank(referee) });
}

// Remove a referee. A referee with games (pay and match history) is kept and
// their login deactivated instead; logins need MANAGE_USERS; admin accounts
// are managed on the Users page, never deleted from here.
export async function DELETE(_req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const referee = await prisma.referee.findUnique({
    where: { id },
    include: { user: { select: { id: true, role: true, name: true } }, _count: { select: { fieldRefGames: true, scorerGames: true } } },
  });
  if (!referee) return NextResponse.json({ error: "Referee not found" }, { status: 404 });

  const refName = referee.user?.name ?? ([referee.firstName, referee.lastName].filter(Boolean).join(" ") || id);
  const hasHistory = referee._count.fieldRefGames + referee._count.scorerGames > 0;

  if (referee.user) {
    if (!hasPermission(session.user, "MANAGE_USERS")) {
      return NextResponse.json({ error: "Removing a referee's login needs the Manage users permission." }, { status: 403 });
    }
    if (referee.user.role === "ADMIN") {
      return NextResponse.json({ error: "That's an administrator's account: manage it on the Users page." }, { status: 409 });
    }
    if (hasHistory) {
      await prisma.$transaction([
        prisma.user.update({ where: { id: referee.user.id }, data: { active: false } }),
        prisma.authSession.deleteMany({ where: { userId: referee.user.id } }),
      ]);
      await audit(session, { action: "referee.deactivate", summary: `Deactivated referee ${refName} (kept: has game history)`, entityType: "Referee", entityId: id, details: { userId: referee.user.id } });
      return NextResponse.json({ ok: true, deactivated: true });
    }
    await prisma.user.delete({ where: { id: referee.user.id } }); // cascades to the referee profile
  } else {
    if (hasHistory) {
      return NextResponse.json({ error: "This referee has game history, so they're kept." }, { status: 409 });
    }
    await prisma.referee.delete({ where: { id } });
  }
  await audit(session, {
    action: "referee.delete",
    summary: `Deleted referee ${refName}${referee.user ? " and their login" : ""}`,
    entityType: "Referee",
    entityId: id,
    details: { userId: referee.userId, playFootballId: referee.playFootballId },
  });
  return NextResponse.json({ ok: true, deactivated: false });
}
