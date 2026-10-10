import type { NextConfig } from "next";

// Content Security Policy. Next.js needs inline scripts and styles; the
// gallery embeds Facebook, and Stripe is allowed for when bookings open.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://connect.facebook.net https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.facebook.com https://api.stripe.com",
  "frame-src https://www.facebook.com https://web.facebook.com https://js.stripe.com https://checkout.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Dev mode (hot reload) needs eval, so the CSP applies to production builds only.
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: csp }] : []),
];

const nextConfig: NextConfig = {
  // Self-hosted in Docker: emit a minimal standalone server bundle.
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
