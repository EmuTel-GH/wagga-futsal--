import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicFixtureSelect } from "@/lib/publicFixture";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Draft fixtures aren't public yet.
  const fixture = await prisma.fixture.findFirst({
    where: { id, status: { not: "DRAFT" } },
    select: publicFixtureSelect, // public: no team contacts, notes or referee ids
  });
  if (!fixture) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(fixture);
}
