import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signIn } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email or username required" }, { status: 400 });
  }

  const login = String(email).toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: login } });

  if (user && !user.active) {
    await audit(user, { action: "auth.login_blocked", summary: `Sign-in refused: ${login} is deactivated`, entityType: "User", entityId: user.id });
    return NextResponse.json({ error: "This account has been deactivated — contact admin@waggafutsal.com.au" }, { status: 403 });
  }

  // First sign-in for an account created without a password (e.g. imported
  // referees): tell the client to run the create-password step instead.
  if (user?.mustSetPassword) {
    return NextResponse.json({ mustSetPassword: true });
  }

  if (!user || !password || !(await verifyPassword(password, user.passwordHash))) {
    await audit(null, {
      action: "auth.login_failed",
      summary: `Failed sign-in for ${login.slice(0, 100)}`,
      entityType: user ? "User" : undefined,
      entityId: user?.id,
    });
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  await signIn(user.id);
  await audit(user, { action: "auth.login", summary: `${user.name} signed in`, entityType: "User", entityId: user.id });

  return NextResponse.json({ role: user.role, name: user.name });
}
