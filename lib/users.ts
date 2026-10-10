import type { Permission, UserRole } from "@prisma/client";

export const PERMISSIONS: { key: Permission; label: string; description: string }[] = [
  { key: "MANAGE_USERS", label: "Manage users", description: "Add, edit and deactivate users and set permissions" },
  { key: "OVERRIDE_RULES", label: "Override rules", description: "Proceed past eligibility blocks (with a recorded reason)" },
  { key: "VIEW_AUDIT", label: "View audit log", description: "See everything every user has done" },
  { key: "MANAGE_PAYROLL", label: "Manage payroll", description: "Pay rates, the ABA pay file, and referees' bank details" },
];

export const ROLES: { key: UserRole; label: string }[] = [
  { key: "ADMIN", label: "Administrator" },
  { key: "REFEREE", label: "Referee" },
];

export function cleanPermissions(role: UserRole, input: unknown): Permission[] {
  if (role !== "ADMIN" || !Array.isArray(input)) return [];
  const valid = PERMISSIONS.map((p) => p.key);
  return [...new Set(input.filter((p): p is Permission => valid.includes(p as Permission)))];
}

export const MIN_ADMIN_SET_PASSWORD = 10;
