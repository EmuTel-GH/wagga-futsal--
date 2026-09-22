import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { importRegistrations } from "@/lib/importRegistrations";

// POST /api/players/import — upload the PlayFootball "AllRegistrations" CSV.
// Creates/updates players, team officials (coach/manager) and referees.
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const summary = await importRegistrations(await file.text());
  return NextResponse.json(summary);
}
