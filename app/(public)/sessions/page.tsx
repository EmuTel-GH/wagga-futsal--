import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Book a Session" };

export default async function SessionsPage() {
  // Show sessions that started within the last 3 hours (covers in-progress sessions)
  const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const sessions = await prisma.futsalSession.findMany({
    where: { status: { in: ["OPEN", "FULL"] }, scheduledAt: { gte: cutoff } },
    include: {
      pitch: { select: { name: true, venue: { select: { name: true } } } },
      _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-black text-navy mb-2">Book a Futsal Session</h1>
      <p className="text-muted mb-8">
        Drop-in and paid futsal sessions open to all ages and skill levels.
        Secure your spot online — payments processed securely via Stripe.
      </p>

      {sessions.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-12 text-center">
          <p className="text-muted">No sessions currently available. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((s) => {
            const spotsLeft = s.capacityMax - s._count.bookings;
            const isFull = spotsLeft <= 0 || s.status === "FULL";
            return (
              <div
                key={s.id}
                className={`bg-white border rounded-2xl p-5 flex flex-col ${
                  isFull ? "border-border opacity-70" : "border-border hover:border-brand transition-colors"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h2 className="font-black text-navy text-lg leading-tight">{s.title}</h2>
                  <span className="text-brand font-black text-xl">
                    ${(s.priceCents / 100).toFixed(0)}
                  </span>
                </div>

                {s.description && <p className="text-muted text-sm mb-3">{s.description}</p>}

                <div className="text-sm text-navy space-y-1 mb-4">
                  <p>
                    <span className="text-muted">Date: </span>
                    {new Date(s.scheduledAt).toLocaleDateString("en-AU", {
                      weekday: "long", day: "numeric", month: "long", year: "numeric",
                    })}
                  </p>
                  <p>
                    <span className="text-muted">Time: </span>
                    {new Date(s.scheduledAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {s.durationMins} mins
                  </p>
                  {s.pitch && (
                    <p>
                      <span className="text-muted">Where: </span>
                      {s.pitch.name}
                    </p>
                  )}
                  <p>
                    <span className="text-muted">Spots: </span>
                    {isFull ? (
                      <span className="text-red-500 font-semibold">Full</span>
                    ) : (
                      <span className="text-green-600 font-semibold">{spotsLeft} remaining</span>
                    )}
                  </p>
                </div>

                {isFull ? (
                  <button disabled className="w-full bg-border text-muted font-bold py-2.5 rounded-lg cursor-not-allowed">
                    Session Full
                  </button>
                ) : (
                  <Link
                    href={`/sessions/${s.id}`}
                    className="w-full block text-center bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-lg transition-colors"
                  >
                    Book Now — ${(s.priceCents / 100).toFixed(0)}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
