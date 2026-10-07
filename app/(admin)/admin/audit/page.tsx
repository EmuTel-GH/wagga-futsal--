import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

// Action prefixes offered in the filter, e.g. "team." matches team.player.add.
const CATEGORIES = [
  { value: "auth.", label: "Sign-ins" },
  { value: "eligibility.", label: "Rule overrides" },
  { value: "user.", label: "Users" },
  { value: "team.", label: "Teams" },
  { value: "competition.", label: "Competitions" },
  { value: "fixture.", label: "Fixtures & scoring" },
  { value: "break.", label: "Breaks" },
  { value: "dispensation.", label: "Dispensations" },
  { value: "referee.", label: "Referees" },
  { value: "payroll.", label: "Payroll" },
  { value: "players.", label: "Player imports" },
  { value: "session.", label: "Sessions" },
  { value: "sponsor.", label: "Sponsors" },
  { value: "rules.", label: "Rules" },
];

type Search = { user?: string; action?: string; q?: string; from?: string; to?: string; page?: string };

// Start/end of a calendar day in Sydney (AEST or AEDT, whichever applies).
function sydneyDay(day: string, end: boolean) {
  const time = end ? "23:59:59.999" : "00:00:00";
  const offset =
    new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", timeZoneName: "longOffset" })
      .formatToParts(new Date(`${day}T12:00:00Z`))
      .find((p) => p.type === "timeZoneName")
      ?.value.replace("GMT", "") || "+10:00";
  const d = new Date(`${day}T${time}${offset}`);
  return isNaN(d.getTime()) ? undefined : d;
}

const fmt = (d: Date) =>
  d.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "medium", timeZone: "Australia/Sydney" });

export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  try {
    await requirePermission("VIEW_AUDIT");
  } catch {
    redirect("/admin");
  }

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.AuditLogWhereInput = {};
  if (sp.user) where.userId = sp.user;
  if (sp.action) where.action = { startsWith: sp.action };
  if (sp.q) where.summary = { contains: sp.q, mode: "insensitive" };
  if (sp.from || sp.to) {
    where.createdAt = {
      ...(sp.from ? { gte: sydneyDay(sp.from, false) } : {}),
      ...(sp.to ? { lte: sydneyDay(sp.to, true) } : {}),
    };
  }

  const [entries, total, users] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => {
    const params = new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `/admin/audit?${params}`;
  };

  const field = "border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand bg-white";

  return (
    <div>
      <h1 className="text-2xl font-black text-navy mb-2">Audit log</h1>
      <p className="text-sm text-muted mb-6">
        Every change made by a signed-in administrator or referee, plus sign-ins. Times are Sydney time.
      </p>

      <form className="flex flex-wrap gap-2 items-end mb-4" method="get">
        <select name="user" defaultValue={sp.user ?? ""} className={field}>
          <option value="">Everyone</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select name="action" defaultValue={sp.action ?? ""} className={field}>
          <option value="">All activity</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search text…" className={`${field} w-44`} />
        <label className="text-[10px] text-muted">From<input type="date" name="from" defaultValue={sp.from ?? ""} className={`${field} block`} /></label>
        <label className="text-[10px] text-muted">To<input type="date" name="to" defaultValue={sp.to ?? ""} className={`${field} block`} /></label>
        <button className="bg-brand text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-brand-dark">Filter</button>
        <Link href="/admin/audit" className="text-xs text-brand font-semibold hover:underline py-1.5">Clear</Link>
      </form>

      <p className="text-xs text-muted mb-2">
        {total.toLocaleString()} entr{total === 1 ? "y" : "ies"}{pages > 1 && ` · page ${page} of ${pages}`}
      </p>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {entries.length === 0 ? (
          <p className="text-center text-muted py-8 text-sm">Nothing recorded for this filter.</p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((e) => (
              <li key={e.id} className="px-4 py-2.5 text-xs">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="text-muted tabular-nums w-44 shrink-0">{fmt(e.createdAt)}</span>
                  <span className="font-semibold text-navy w-36 shrink-0 truncate" title={e.actorEmail ?? undefined}>
                    {e.actorName ?? <span className="italic text-muted">anonymous</span>}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      e.action.startsWith("eligibility.")
                        ? "bg-amber-50 text-amber-700 border border-amber-300"
                        : e.action.includes("failed") || e.action.includes("blocked")
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-navy/10 text-navy"
                    }`}
                  >
                    {e.action}
                  </span>
                  <span className="text-navy flex-1 min-w-[12rem]">{e.summary}</span>
                </div>
                {(e.details !== null || e.ip) && (
                  <details className="mt-1 ml-0 sm:ml-[11.75rem]">
                    <summary className="text-muted cursor-pointer select-none">Details{e.ip ? ` · ${e.ip}` : ""}</summary>
                    <pre className="mt-1 bg-gray-50 border border-border rounded p-2 overflow-x-auto text-[11px] whitespace-pre-wrap break-all">
                      {JSON.stringify({ entity: e.entityType ? `${e.entityType} ${e.entityId ?? ""}`.trim() : undefined, ...(e.details as object | null) }, null, 2)}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {pages > 1 && (
        <div className="flex gap-3 justify-center mt-4 text-xs">
          {page > 1 && <Link href={link(page - 1)} className="text-brand font-semibold hover:underline">← Newer</Link>}
          {page < pages && <Link href={link(page + 1)} className="text-brand font-semibold hover:underline">Older →</Link>}
        </div>
      )}
    </div>
  );
}
