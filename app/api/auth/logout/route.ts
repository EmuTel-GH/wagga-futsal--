import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (token) {
    const session = await getSession();
    await prisma.authSession.deleteMany({ where: { token } }).catch(() => {});
    cookieStore.delete("session");
    if (session) {
      await audit(session, { action: "auth.logout", summary: `${session.user.name} signed out`, entityType: "User", entityId: session.user.id });
    }
  }
  return NextResponse.json({ ok: true });
}
