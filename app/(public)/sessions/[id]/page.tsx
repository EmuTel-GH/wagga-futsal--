import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BookingForm from "./BookingForm";
import { bookingsEnabled } from "@/lib/bookings";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const session = await prisma.futsalSession.findUnique({ where: { id } });
  return { title: session ? `Book: ${session.title}` : "Book a Session" };
}

export default async function SessionBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await prisma.futsalSession.findUnique({
    where: { id },
    include: { _count: { select: { bookings: { where: { status: "CONFIRMED" } } } } },
  });

  if (!session || session.status === "CANCELLED") notFound();

  const spotsLeft = session.capacityMax - session._count.bookings;

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-black text-navy mb-1">{session.title}</h1>
      <p className="text-muted text-sm mb-6">
        {new Date(session.scheduledAt).toLocaleDateString("en-AU", {
          weekday: "long", day: "numeric", month: "long",
        })}{" · "}
        {new Date(session.scheduledAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
        {" · "}{session.durationMins} mins{" · "}
        <span className="font-semibold text-brand">${(session.priceCents / 100).toFixed(2)}</span>
      </p>

      {!bookingsEnabled() ? (
        <div className="bg-gray-50 border border-border rounded-xl p-6 text-center">
          <p className="font-bold text-navy">Online booking isn&apos;t open yet.</p>
        </div>
      ) : spotsLeft <= 0 || session.status === "FULL" ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="font-bold text-red-700">This session is full.</p>
        </div>
      ) : (
        <BookingForm sessionId={session.id} spotsLeft={spotsLeft} priceCents={session.priceCents} />
      )}
    </div>
  );
}
