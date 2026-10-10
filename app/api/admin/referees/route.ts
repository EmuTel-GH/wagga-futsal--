import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requirePermission, hashPassword } from "@/lib/auth";
import { MIN_ADMIN_SET_PASSWORD } from "@/lib/users";
import { audit } from "@/lib/audit";
import { maskBank } from "@/lib/bankDetails";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const referees = await prisma.referee.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      _count: { select: { fieldRefGames: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json(referees.map((r) => ({ ...r, ...maskBank(r) })));
}

// Create a referee login (+ referee profile). Logins are user management, so
// this needs MANAGE_USERS like the Users page.
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
  const password = String(body.password ?? "");
  const phone = body.phone ? String(body.phone).trim().slice(0, 30) : null;

  if (!name || !email || !password) {
    return NextResponse.json({ error: "name, email and password are required" }, { status: 400 });
  }
  if (password.length < MIN_ADMIN_SET_PASSWORD) {
    return NextResponse.json({ error: `Password must be at least ${MIN_ADMIN_SET_PASSWORD} characters` }, { status: 400 });
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), role: "REFEREE", referee: { create: { phone } } },
    // Never return the password hash.
    select: { id: true, name: true, email: true, role: true, referee: { select: { id: true, phone: true } } },
  });

  await audit(session, {
    action: "referee.create",
    summary: `Created referee login ${email} (${name})`,
    entityType: "User",
    entityId: user.id,
    details: { name, email, phone },
  });

  return NextResponse.json(
    { ...user, referee: { ...user.referee!, bsb: null, accountNumber: null, accountName: null } },
    { status: 201 }
  );
}
