import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { maskBank, sealBank } from "@/lib/bankDetails";

type Params = { params: Promise<{ id: string }> };

// Set (or { clear: true } remove) a referee's bank details. They're encrypted
// before saving and only ever returned masked.
export async function PATCH(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
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
      sealed = sealBank(body);
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

export async function DELETE(_req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const referee = await prisma.referee.findUnique({ where: { id } });
  if (!referee) {
    return NextResponse.json({ error: "Referee not found" }, { status: 404 });
  }

  const refName = [referee.firstName, referee.lastName].filter(Boolean).join(" ");
  if (referee.userId) {
    // Deleting the login cascades to the referee record.
    await prisma.user.delete({ where: { id: referee.userId } });
  } else {
    await prisma.referee.delete({ where: { id } });
  }
  await audit(session, {
    action: "referee.delete",
    summary: `Deleted referee ${refName || id}${referee.userId ? " and their login" : ""}`,
    entityType: "Referee",
    entityId: id,
    details: { userId: referee.userId, playFootballId: referee.playFootballId },
  });

  return NextResponse.json({ ok: true });
}
