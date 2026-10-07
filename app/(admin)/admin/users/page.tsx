import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import UsersClient from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  let session;
  try {
    session = await requirePermission("MANAGE_USERS");
  } catch {
    redirect("/admin");
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissions: true,
      active: true,
      mustSetPassword: true,
      lastLoginAt: true,
      createdAt: true,
      referee: { select: { id: true } },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <h1 className="text-2xl font-black text-navy mb-2">Users</h1>
      <p className="text-sm text-muted mb-6">
        Who can sign in, what they can do, and whether their account is active. Every change here is recorded in the audit log.
      </p>
      <UsersClient initialUsers={users} currentUserId={session.user.id} />
    </div>
  );
}
