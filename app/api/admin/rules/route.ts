import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const doc = await prisma.rulesDocument.findFirst({
    where: { active: true },
    orderBy: { publishedAt: "desc" },
  });

  return NextResponse.json(doc ?? null);
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, content, version } = await req.json();

  if (!title || !content || !version) {
    return NextResponse.json({ error: "title, content and version are required" }, { status: 400 });
  }

  // Deactivate all existing documents, then create new active one
  await prisma.rulesDocument.updateMany({ data: { active: false } });

  const doc = await prisma.rulesDocument.create({
    data: { title, content, version, active: true },
  });

  await audit(session, {
    action: "rules.publish",
    summary: `Published rules "${title}" version ${version}`,
    entityType: "RulesDocument",
    entityId: doc.id,
    details: { title, version, characters: String(content).length },
  });

  return NextResponse.json(doc, { status: 201 });
}
