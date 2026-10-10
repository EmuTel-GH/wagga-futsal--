import { redirect } from "next/navigation";
import { adminPage, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PayrollClient from "./PayrollClient";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const session = await adminPage(); // own check: layouts don't re-run on every navigation
  if (!hasPermission(session.user, "MANAGE_PAYROLL")) redirect("/admin");
  const rate = await prisma.payRate.findFirst();

  return (
    <div>
      <h1 className="text-2xl font-black text-navy mb-1">Payroll</h1>
      <p className="text-muted text-sm mb-8">
        Set game fees, preview referee earnings for a period, and download an ABA file ready to import into your banking software.
      </p>
      <PayrollClient initialRate={rate} />
    </div>
  );
}
