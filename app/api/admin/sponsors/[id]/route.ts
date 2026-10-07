import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const allowed = ["name", "logoUrl", "website", "tier", "sortOrder", "active"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      if (key === "sortOrder") {
        data[key] = Number(body[key]);
      } else {
        data[key] = body[key];
      }
    }
  }

  const sponsor = await prisma.sponsor.update({ where: { id }, data });

  await audit(session, {
    action: "sponsor.update",
    summary: `Updated sponsor ${sponsor.name} (${Object.keys(data).join(", ")})`,
    entityType: "Sponsor",
    entityId: id,
    details: data,
  });

  return NextResponse.json(sponsor);
}

export async function DELETE(_req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const sponsor = await prisma.sponsor.delete({ where: { id } });
  await audit(session, { action: "sponsor.delete", summary: `Deleted sponsor ${sponsor.name}`, entityType: "Sponsor", entityId: id, details: sponsor });

  return NextResponse.json({ ok: true });
}
