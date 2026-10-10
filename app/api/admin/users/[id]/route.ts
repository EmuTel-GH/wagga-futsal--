import { NextResponse } from "next/server";
import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { cleanPermissions, MIN_ADMIN_SET_PASSWORD } from "@/lib/users";
import { createSetupLink } from "@/lib/setupLinks";
import { setupUrl } from "@/lib/setupTokens";
import { siteUrl } from "@/lib/siteUrl";

type Params = { params: Promise<{ id: string }> };

const SELECT = { id: true, name: true, email: true, role: true, permissions: true, active: true, mustSetPassword: true, lastLoginAt: true, createdAt: true } as const;

// Edit a user: name, login, role, permissions, active status, and password
// resets. You can't lock yourself out — no deactivating, demoting or removing
// Manage users from your own account — so at least one user manager remains.
export async function PATCH(req: Request, { params }: Params) {
  let session;
  try {
    session = await requirePermission("MANAGE_USERS");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const isSelf = id === session.user.id;

  const data: Prisma.UserUpdateInput = {};
  const changes: string[] = [];
  let revokeSessions = false;

  if (typeof body.name === "string" && body.name.trim() && body.name.trim() !== user.name) {
    data.name = body.name.trim();
    changes.push(`name → ${data.name}`);
  }
  if (typeof body.email === "string" && body.email.trim()) {
    const email = body.email.toLowerCase().trim();
    if (email !== user.email) {
      if (await prisma.user.findUnique({ where: { email } })) {
        return NextResponse.json({ error: "That email/username is already in use" }, { status: 409 });
      }
      data.email = email;
      changes.push(`login → ${email}`);
    }
  }

  const role: UserRole = body.role === "ADMIN" || body.role === "REFEREE" ? body.role : user.role;
  if (role !== user.role) {
    if (isSelf) return NextResponse.json({ error: "You can't change your own role." }, { status: 400 });
    data.role = role;
    changes.push(`role → ${role.toLowerCase()}`);
  }
  if ("permissions" in body || role !== user.role) {
    const permissions = cleanPermissions(role, "permissions" in body ? body.permissions : user.permissions);
    if (isSelf && user.permissions.includes("MANAGE_USERS") && !permissions.includes("MANAGE_USERS")) {
      return NextResponse.json({ error: "You can't remove Manage users from your own account." }, { status: 400 });
    }
    const added = permissions.filter((p) => !user.permissions.includes(p));
    const removed = user.permissions.filter((p) => !permissions.includes(p));
    if (added.length || removed.length) {
      data.permissions = permissions;
      if (added.length) changes.push(`granted ${added.join(", ")}`);
      if (removed.length) changes.push(`revoked ${removed.join(", ")}`);
    }
  }

  if (typeof body.active === "boolean" && body.active !== user.active) {
    if (isSelf) return NextResponse.json({ error: "You can't deactivate your own account." }, { status: 400 });
    data.active = body.active;
    changes.push(body.active ? "reactivated" : "deactivated");
    if (!body.active) revokeSessions = true;
  }

  if (body.password) {
    if (String(body.password).length < MIN_ADMIN_SET_PASSWORD) {
      return NextResponse.json({ error: `Password must be at least ${MIN_ADMIN_SET_PASSWORD} characters` }, { status: 400 });
    }
    data.passwordHash = await hashPassword(String(body.password));
    data.mustSetPassword = false;
    changes.push("password reset by administrator");
    revokeSessions = !isSelf;
  } else if (body.requirePasswordSetup === true) {
    if (isSelf) return NextResponse.json({ error: "Use My account to change your own password." }, { status: 400 });
    data.passwordHash = await hashPassword(crypto.randomUUID());
    data.mustSetPassword = true;
    changes.push("password cleared — set-up link created");
    revokeSessions = true;
  }

  if (body.revokeSessions === true && !isSelf) {
    revokeSessions = true;
    changes.push("signed out everywhere");
  }

  if (changes.length === 0) {
    return NextResponse.json(await prisma.user.findUnique({ where: { id }, select: SELECT }));
  }

  const [updated] = await prisma.$transaction([
    prisma.user.update({ where: { id }, data, select: SELECT }),
    ...(revokeSessions ? [prisma.authSession.deleteMany({ where: { userId: id } })] : []),
  ]);

  await audit(session, {
    action: "user.update",
    summary: `Updated user ${user.name} (${user.email}): ${changes.join("; ")}`,
    entityType: "User",
    entityId: id,
    details: { changes, revokedSessions: revokeSessions },
  });

  // A cleared password comes with a one-time set-up link to send to them.
  if (body.requirePasswordSetup === true) {
    const { token, expiresAt } = await createSetupLink(id, session.user.id);
    return NextResponse.json({ ...updated, setupUrl: setupUrl(siteUrl(req), token), setupExpiresAt: expiresAt });
  }
  return NextResponse.json(updated);
}

// Delete a login. Users with a referee profile hold game and pay history, so
// they are deactivated instead.
export async function DELETE(_req: Request, { params }: Params) {
  let session;
  try {
    session = await requirePermission("MANAGE_USERS");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { id }, include: { referee: { select: { id: true } } } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.referee) {
    return NextResponse.json(
      { error: "This user has a referee profile (games and pay history). Deactivate them instead." },
      { status: 409 }
    );
  }

  await prisma.user.delete({ where: { id } });
  await audit(session, {
    action: "user.delete",
    summary: `Deleted user ${user.name} (${user.email})`,
    entityType: "User",
    entityId: id,
    details: { name: user.name, email: user.email, role: user.role, permissions: user.permissions },
  });

  return NextResponse.json({ ok: true });
}
