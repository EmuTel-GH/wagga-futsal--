import { cookies } from "next/headers";
import type { Permission } from "@prisma/client";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, in seconds

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  const session = await prisma.authSession.create({
    data: { userId, expiresAt },
  });
  return session.token;
}

/** Create a session and set the cookie (shared by login and first-password setup). */
export async function signIn(userId: string) {
  const token = await createSession(userId);
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  const session = await prisma.authSession.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) return null;
  // Deactivated accounts lose access immediately, even with a live cookie.
  if (!session.user.active) return null;
  return session;
}

export type AuthSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
  return session;
}

export async function requireReferee() {
  const session = await requireAuth();
  return session;
}

export function hasPermission(user: { role: string; permissions: Permission[] }, permission: Permission) {
  return user.role === "ADMIN" && user.permissions.includes(permission);
}

/** An ADMIN who also holds the given permission. */
export async function requirePermission(permission: Permission) {
  const session = await requireAdmin();
  if (!hasPermission(session.user, permission)) {
    throw new Error("Forbidden");
  }
  return session;
}
