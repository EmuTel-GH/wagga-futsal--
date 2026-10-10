import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { bookingsEnabled } from "@/lib/bookings";

export async function POST(req: Request) {
  if (!bookingsEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Webhook signature invalid" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    await prisma.sessionBooking.updateMany({
      where: { stripeSessionId: session.id },
      data: { status: "CONFIRMED", stripePaymentIntentId: session.payment_intent as string },
    });

    // Check if session is now full
    const booking = await prisma.sessionBooking.findFirst({
      where: { stripeSessionId: session.id },
    });

    if (booking) {
      const confirmed = await prisma.sessionBooking.count({
        where: { sessionId: booking.sessionId, status: "CONFIRMED" },
      });
      const futsalSession = await prisma.futsalSession.findUnique({
        where: { id: booking.sessionId },
      });
      if (futsalSession && confirmed >= futsalSession.capacityMax) {
        await prisma.futsalSession.update({
          where: { id: booking.sessionId },
          data: { status: "FULL" },
        });
      }
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    await prisma.sessionBooking.updateMany({
      where: { stripeSessionId: session.id, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
  }

  return NextResponse.json({ received: true });
}
