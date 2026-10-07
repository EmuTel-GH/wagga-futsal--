import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { bsb, accountNumber, accountName } = await req.json();

  const referee = await prisma.referee.update({
    where: { id },
    data: {
      bsb: bsb || null,
      accountNumber: accountNumber || null,
      accountName: accountName || null,
    },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  await audit(session, {
    action: "referee.bank_details.update",
    summary: `Updated bank details for ${referee.user?.name ?? ([referee.firstName, referee.lastName].filter(Boolean).join(" ") || "referee")}`,
    entityType: "Referee",
    entityId: id,
    details: { bsb, accountNumber, accountName },
  });

  return NextResponse.json(referee);
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
