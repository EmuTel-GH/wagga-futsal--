import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { cleanPermissions, MIN_ADMIN_SET_PASSWORD } from "@/lib/users";

// Create a user. Either give them a temporary password (which they should
// change under My account), or leave it blank so they create one on first
// sign-in — like imported referees.
export async function POST(req: Request) {
  let session;
  try {
    session = await requirePermission("MANAGE_USERS");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").toLowerCase().trim();
  const role: UserRole = body.role === "ADMIN" ? "ADMIN" : "REFEREE";
  const password = body.password ? String(body.password) : "";

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email/username are required" }, { status: 400 });
  }
  if (password && password.length < MIN_ADMIN_SET_PASSWORD) {
    return NextResponse.json({ error: `Password must be at least ${MIN_ADMIN_SET_PASSWORD} characters` }, { status: 400 });
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "That email/username is already in use" }, { status: 409 });
  }

  const permissions = cleanPermissions(role, body.permissions);
  const [firstName, ...rest] = name.split(/\s+/);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      role,
      permissions,
      // Without a password the account must set one on first sign-in.
      passwordHash: await hashPassword(password || crypto.randomUUID()),
      mustSetPassword: !password,
      // Referees need a referee profile to be assigned games and paid.
      ...(role === "REFEREE" ? { referee: { create: { firstName, lastName: rest.join(" ") || null } } } : {}),
    },
    select: { id: true, name: true, email: true, role: true, permissions: true, active: true, mustSetPassword: true, lastLoginAt: true, createdAt: true },
  });

  await audit(session, {
    action: "user.create",
    summary: `Created ${role === "ADMIN" ? "administrator" : "referee"} ${name} (${email})${permissions.length ? ` with ${permissions.join(", ")}` : ""}`,
    entityType: "User",
    entityId: user.id,
    details: { name, email, role, permissions, passwordSetBy: password ? "admin" : "user on first sign-in" },
  });

  return NextResponse.json(user, { status: 201 });
}
