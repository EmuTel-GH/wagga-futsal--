import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";

// Signed-in user changes their own password. Other sessions are signed out.
export async function POST(req: Request) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required" }, { status: 400 });
  }
  if (String(newPassword).length < 10) {
    return NextResponse.json({ error: "New password must be at least 10 characters" }, { status: 400 });
  }
  if (!(await verifyPassword(currentPassword, session.user.passwordHash))) {
    await audit(session, { action: "auth.change_password_failed", summary: `${session.user.name} entered the wrong current password`, entityType: "User", entityId: session.user.id });
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: session.user.id }, data: { passwordHash: await hashPassword(newPassword) } }),
    prisma.authSession.deleteMany({ where: { userId: session.user.id, id: { not: session.id } } }),
  ]);
  await audit(session, { action: "auth.change_password", summary: `${session.user.name} changed their password`, entityType: "User", entityId: session.user.id });

  return NextResponse.json({ ok: true });
}
