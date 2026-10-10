import { adminPage } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RulesClient from "./RulesClient";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  await adminPage(); // own check: layouts don't re-run on every navigation
  const doc = await prisma.rulesDocument.findFirst({
    where: { active: true },
    orderBy: { publishedAt: "desc" },
  });

  const serialised = doc ? { ...doc, publishedAt: doc.publishedAt.toISOString() } : null;

  return (
    <div>
      <h1 className="text-2xl font-black text-navy mb-6">Rules Document</h1>
      <RulesClient initialDoc={serialised} />
    </div>
  );
}
