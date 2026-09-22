import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = { title: "Register — Summer 2026" };

const REGISTER_URL =
  "https://playfootball.com.au/football-finder?st=location&lat=-35.1053&lng=147.3605&suburb=Wagga+Wagga&state_code=NSW&postcode=2650&clubId=75505";

const KICKOFF = [
  {
    day: "Wednesday",
    date: "14 October 2026",
    divisions: [
      { name: "U8 Mixed", time: "4:30pm / 5:00pm" },
      { name: "U10 Mixed", time: "5:00pm / 5:30pm" },
      { name: "U16 Mixed", time: "5:30pm / 6:00pm" },
      { name: "Opens", time: "6:45pm / 7:30pm" },
    ],
  },
  {
    day: "Thursday",
    date: "15 October 2026",
    divisions: [
      { name: "U12 Mixed", time: "5:00pm / 5:30pm" },
      { name: "U14 Mixed", time: "5:00pm / 5:30pm" },
    ],
  },
];

export default function RegisterPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-navy text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-brand font-semibold text-sm uppercase tracking-widest mb-3">
            Summer 2026 Season · Registration Open
          </p>
          <h1 className="text-4xl md:text-5xl font-black mb-4">
            You Are Your Only <span className="text-brand">Limit!</span>
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">
            High speed, high energy, high skill — the ultimate summer sport is here. Indoor futsal
            for all ages, from Under 8s to Opens.
          </p>
          <a
            href={REGISTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-brand hover:bg-brand-dark text-white font-bold px-8 py-3.5 rounded-lg transition-colors text-lg"
          >
            Register Now
          </a>
          <p className="text-white/50 text-sm mt-3">
            Registration via PlayFootball · short link:{" "}
            <a
              href="https://bit.ly/3TxOP64"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              bit.ly/3TxOP64
            </a>
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-12 space-y-12">
        {/* Kick-off dates */}
        <section>
          <h2 className="text-3xl font-black text-navy text-center mb-8">Kick Off Dates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {KICKOFF.map((d) => (
              <div key={d.day} className="bg-white border border-border rounded-2xl overflow-hidden">
                <div className="bg-navy text-white px-6 py-4">
                  <p className="font-black text-lg">{d.day}</p>
                  <p className="text-brand font-semibold text-sm">{d.date}</p>
                </div>
                <ul className="divide-y divide-border">
                  {d.divisions.map((div) => (
                    <li key={div.name} className="flex items-center justify-between px-6 py-3.5">
                      <span className="font-bold text-navy">{div.name}</span>
                      <span className="text-muted text-sm font-medium">{div.time}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-center text-muted text-sm mt-4">
            Two times shown = early / late game slots for that division.
          </p>
        </section>

        {/* Fees */}
        <section>
          <h2 className="text-3xl font-black text-navy text-center mb-8">Registration Fees</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white border border-border rounded-2xl p-8 text-center">
              <p className="text-muted text-sm font-semibold uppercase tracking-widest mb-2">
                Junior Player
              </p>
              <p className="text-5xl font-black text-navy">$215</p>
              <p className="text-muted text-sm mt-2">U8 – U16 divisions</p>
            </div>
            <div className="bg-white border border-border rounded-2xl p-8 text-center">
              <p className="text-muted text-sm font-semibold uppercase tracking-widest mb-2">
                Senior Player
              </p>
              <p className="text-5xl font-black text-navy">$230</p>
              <p className="text-muted text-sm mt-2">Opens divisions</p>
            </div>
            <div className="bg-white border border-border rounded-2xl p-8 text-center">
              <p className="text-muted text-sm font-semibold uppercase tracking-widest mb-2">
                Additional Team
              </p>
              <p className="text-5xl font-black text-navy">$135</p>
              <p className="text-muted text-sm mt-2">per extra team you join</p>
            </div>
          </div>
          <p className="text-center text-muted text-sm mt-5 max-w-2xl mx-auto">
            Your registration covers your first team. Want more court time? You can also play for
            additional teams in <span className="font-semibold text-navy">other competitions</span> for
            $135 per extra team — arranged directly with Wagga Futsal.
          </p>
        </section>

        {/* How to register + contact */}
        <section className="bg-navy rounded-3xl px-8 py-10 text-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-2xl font-black mb-4">Ready to play?</h2>
              <ol className="space-y-3 text-white/80 text-sm list-decimal list-inside mb-6">
                <li>
                  Register on{" "}
                  <a
                    href={REGISTER_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand font-semibold hover:underline"
                  >
                    PlayFootball
                  </a>{" "}
                  (search &ldquo;Wagga Futsal&rdquo;)
                </li>
                <li>Pick your division — teams and individual players welcome</li>
                <li>We&apos;ll confirm your draw before kick-off in October</li>
              </ol>
              <a
                href={REGISTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3 rounded-lg transition-colors"
              >
                Register Now
              </a>
            </div>
            <div className="space-y-3 text-sm">
              <p className="text-white font-semibold uppercase tracking-widest text-xs mb-4">
                Questions?
              </p>
              <p>
                <a href="mailto:admin@waggafutsal.com.au" className="text-white/80 hover:text-brand">
                  ✉️ admin@waggafutsal.com.au
                </a>
              </p>
              <p>
                <a
                  href="https://www.facebook.com/waggafutsal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-brand"
                >
                  👍 facebook.com/waggafutsal
                </a>
              </p>
              <p className="text-white/80">🌐 www.waggafutsal.com.au</p>
              <div className="flex items-center gap-3 pt-4 border-t border-white/10 mt-4">
                <Image src="/logo.png" alt="Wagga Futsal" width={40} height={40} className="rounded" />
                <p className="text-white/50 text-xs">
                  Affiliated with Football NSW Futsal · Est. 2012
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
