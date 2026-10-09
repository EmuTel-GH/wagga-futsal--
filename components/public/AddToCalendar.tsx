"use client";

import { useEffect, useRef, useState } from "react";

// "📅 Add to calendar": subscribes the phone/computer calendar to a live
// feed (fixtures update themselves when the draw changes), with a one-off
// download as a fallback. feedPath is site-relative, e.g. /api/teams/x/calendar.
export default function AddToCalendar({ feedPath, name, compact = false }: { feedPath: string; name: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setOrigin(window.location.origin); // eslint-disable-line react-hooks/set-state-in-effect -- browser-only value
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const https = `${origin}${feedPath}`;
  const webcal = https.replace(/^https?:/, "webcal:");
  const sep = feedPath.includes("?") ? "&" : "?";
  const options = [
    { label: "iPhone / iPad / Mac", hint: "Apple Calendar", href: webcal },
    { label: "Google Calendar", hint: "Android & web", href: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}` },
    { label: "Outlook", hint: "Outlook.com & Microsoft 365", href: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent(name)}` },
    { label: "Download file (.ics)", hint: "one-off copy, won't update", href: `${https}${sep}download=1` },
  ];

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen((v) => !v)}
        className={`bg-navy text-white font-bold rounded-lg hover:bg-navy/90 transition-colors ${compact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"}`}>
        📅 Add to calendar
      </button>
      {open && origin && (
        <div className="absolute z-20 mt-2 w-72 bg-white border border-border rounded-xl shadow-xl p-2 left-0">
          <p className="text-[11px] text-muted px-2 pb-2">
            Games, byes and results appear in your calendar and update automatically if the draw changes.
          </p>
          {options.map((o) => (
            <a key={o.label} href={o.href} target={o.href.startsWith("webcal:") ? undefined : "_blank"} rel="noopener"
              className="block px-3 py-2 rounded-lg hover:bg-gray-50">
              <span className="block text-sm font-semibold text-navy">{o.label}</span>
              <span className="block text-[11px] text-muted">{o.hint}</span>
            </a>
          ))}
          <button
            onClick={() => navigator.clipboard?.writeText(https).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
            className="block w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-semibold text-navy">
            {copied ? "✓ Link copied" : "Copy calendar link"}
          </button>
        </div>
      )}
    </div>
  );
}
