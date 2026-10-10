import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { requireAdmin, hasPermission, type AuthSession } from "@/lib/auth";
import LogoutButton from "@/components/referee/LogoutButton";
import AdminNav from "@/components/admin/AdminNav";
import VersionTag from "@/components/VersionTag";
import { Suspense } from "react";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/competitions", label: "Competitions" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/fixtures", label: "Fixtures" },
  { href: "/admin/referees", label: "Referees" },
  { href: "/admin/sessions", label: "Sessions" },
  { href: "/admin/sponsors", label: "Sponsors" },
  { href: "/admin/rules", label: "Rules" },
];

// Shown only to administrators holding the matching permission.
const RESTRICTED_NAV = [
  { href: "/admin/payroll", label: "Payroll", permission: "MANAGE_PAYROLL" },
  { href: "/admin/users", label: "Users", permission: "MANAGE_USERS" },
  { href: "/admin/audit", label: "Audit log", permission: "VIEW_AUDIT" },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let session: AuthSession;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/referee/login");
  }
  const nav = [...NAV, ...RESTRICTED_NAV.filter((n) => hasPermission(session.user, n.permission))];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar: pinned to the viewport so the nav and account/logout stay
          visible however long the page is; the nav scrolls on its own if needed. */}
      <aside className="w-56 bg-navy text-white flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="px-4 py-5 border-b border-white/10 flex items-center gap-3">
          <Image src="/logo.png" alt="Wagga Futsal" width={36} height={36} className="rounded shrink-0" />
          <div>
            <p className="text-white font-black text-sm leading-tight">WAGGA FUTSAL</p>
            <p className="text-white/40 text-xs">Admin</p>
          </div>
        </div>
        <AdminNav items={nav.map(({ href, label }) => ({ href, label }))} />
        <div className="px-4 py-4 border-t border-white/10 space-y-2">
          <Link href="/admin/account" className="block text-xs text-white/70 hover:text-white truncate" title="My account">
            {session.user.name}
          </Link>
          <LogoutButton />
          <Suspense fallback={null}>
            <VersionTag className="block text-[10px] text-white/30" />
          </Suspense>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 bg-gray-50 min-h-screen overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
