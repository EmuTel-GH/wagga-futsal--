import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { importRegistrations } from "@/lib/importRegistrations";

// POST /api/players/import — upload the PlayFootball "AllRegistrations" CSV.
// Creates/updates players, team officials (coach/manager) and referees.
export async function POST(req: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const summary = await importRegistrations(await file.text());
  await audit(session, {
    action: "players.import",
    summary: `Imported PlayFootball registrations from ${file.name}`,
    entityType: "Player",
    details: summary,
  });

  return NextResponse.json(summary);
}
