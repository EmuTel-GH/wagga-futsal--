import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signIn, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";

// Compared against when the username doesn't exist (or has no usable password
// yet), so every failed sign-in takes about the same time and gets the same
// answer: nothing reveals which usernames exist or are waiting for set-up.
const dummyHash = hashPassword("not-a-real-password-" + Math.random());
const FAILED = { error: "Invalid username or password" };

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email or username required" }, { status: 400 });
  }

  const login = String(email).toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: login } });

  // Accounts waiting for their first password can only be set up through a
  // one-time link from an administrator, never from this form.
  const usable = user && !user.mustSetPassword;
  const ok = await verifyPassword(String(password ?? ""), usable ? user.passwordHash : await dummyHash);
  if (!usable || !password || !ok) {
    await audit(null, {
      action: "auth.login_failed",
      summary: `Failed sign-in for ${login.slice(0, 100)}`,
      entityType: user ? "User" : undefined,
      entityId: user?.id,
    });
    return NextResponse.json(FAILED, { status: 401 });
  }

  // Only someone who knows the password learns the account is deactivated.
  if (!user.active) {
    await audit(user, { action: "auth.login_blocked", summary: `Sign-in refused: ${login} is deactivated`, entityType: "User", entityId: user.id });
    return NextResponse.json({ error: "This account has been deactivated — contact admin@waggafutsal.com.au" }, { status: 403 });
  }

  await signIn(user.id);
  await audit(user, { action: "auth.login", summary: `${user.name} signed in`, entityType: "User", entityId: user.id });

  return NextResponse.json({ role: user.role, name: user.name });
}
