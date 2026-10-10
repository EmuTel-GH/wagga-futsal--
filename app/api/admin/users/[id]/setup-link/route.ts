import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createSetupLink } from "@/lib/setupLinks";
import { setupUrl } from "@/lib/setupTokens";
import { siteUrl } from "@/lib/siteUrl";

type Params = { params: Promise<{ id: string }> };

// Make a one-time password set-up link for a user (replacing any earlier one).
// The admin copies it and sends it to the person directly.
export async function POST(req: Request, { params }: Params) {
  let session;
  try {
    session = await requirePermission("MANAGE_USERS");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, active: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!user.active) return NextResponse.json({ error: "Reactivate the account first" }, { status: 409 });
  if (user.id === session.user.id) return NextResponse.json({ error: "Use My account to change your own password." }, { status: 400 });

  const { token, expiresAt } = await createSetupLink(user.id, session.user.id);
  await audit(session, {
    action: "user.setup_link",
    summary: `Created a password set-up link for ${user.name} (${user.email}), valid 7 days`,
    entityType: "User",
    entityId: user.id,
    details: { expiresAt },
  });
  return NextResponse.json({ setupUrl: setupUrl(siteUrl(req), token), expiresAt });
}
