import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signIn } from "@/lib/auth";
import { audit } from "@/lib/audit";

// First-sign-in password setup: only valid while the account is flagged
// mustSetPassword (i.e. it has never had a password). Sets it and signs in.
export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
  if (!user || !user.mustSetPassword) {
    return NextResponse.json({ error: "This account already has a password — sign in normally." }, { status: 400 });
  }
  if (!user.active) {
    return NextResponse.json({ error: "This account has been deactivated — contact admin@waggafutsal.com.au" }, { status: 403 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustSetPassword: false },
  });

  await signIn(user.id);
  await audit(user, { action: "auth.set_password", summary: `${user.name} set their password on first sign-in`, entityType: "User", entityId: user.id });

  return NextResponse.json({ role: user.role, name: user.name });
}
