import { calendarResponse } from "@/lib/calendarResponse";

export const dynamic = "force-dynamic";

// Public calendar feed for one team (subscribe via webcal://, or ?download=1).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return calendarResponse(req, [id]);
}
