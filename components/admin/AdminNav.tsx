"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sidebar links, with the current section highlighted. A section stays
// highlighted on its sub-pages (e.g. /admin/teams/...), but Dashboard
// (/admin) only on itself, since every admin URL starts with it.
export default function AdminNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-3 space-y-0.5">
      {items.map((n) => {
        const active = isActive(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
              active
                ? "bg-white/15 text-white font-semibold shadow-[inset_3px_0_0_var(--color-brand)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
