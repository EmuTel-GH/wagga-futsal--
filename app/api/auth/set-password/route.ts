import { NextResponse } from "next/server";
import { signIn } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { consumeSetupLink } from "@/lib/setupLinks";

// Set a password with a one-time set-up link from an administrator
// ({ token, password }), then sign in. The link works once, for 7 days.
export async function POST(req: Request) {
  const { token, password } = await req.json();
  if (!password || String(password).length < 10) {
    return NextResponse.json({ error: "Password must be at least 10 characters" }, { status: 400 });
  }

  const result = await consumeSetupLink(token, String(password));
  if (!result.ok) {
    await audit(null, { action: "auth.setup_link_rejected", summary: "A password set-up link was rejected (invalid, expired or used)" });
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await signIn(result.user.id);
  await audit(result.user, { action: "auth.set_password", summary: `${result.user.name} set their password with a set-up link`, entityType: "User", entityId: result.user.id });
  return NextResponse.json({ role: result.user.role, name: result.user.name });
}
