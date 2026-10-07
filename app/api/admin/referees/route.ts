import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import bcrypt from "bcryptjs";

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

  return NextResponse.json(referees);
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, email, password, phone } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "name, email and password are required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "REFEREE",
      referee: {
        create: { phone: phone || null },
      },
    },
    include: {
      referee: true,
    },
  });

  await audit(session, {
    action: "referee.create",
    summary: `Created referee login ${email} (${name})`,
    entityType: "User",
    entityId: user.id,
    details: { name, email, phone },
  });

  return NextResponse.json(user, { status: 201 });
}
