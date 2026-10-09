import { NextResponse } from "next/server";
import { calendarResponse } from "@/lib/calendarResponse";

export const dynamic = "force-dynamic";

// Public calendar feed for several teams at once: /api/calendar?teams=a,b,c (max 10).
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("teams") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return new NextResponse("teams=… required", { status: 400 });
  return calendarResponse(req, ids);
}
