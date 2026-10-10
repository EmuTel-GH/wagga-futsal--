import type { Metadata } from "next";
import { Suspense } from "react";
import EnvBanner from "@/components/EnvBanner";
import { runtimeInfo } from "@/lib/runtimeInfo";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const baseMetadata: Metadata = {
  title: { default: "Wagga Futsal", template: "%s | Wagga Futsal" },
  description: "Wagga Wagga's premier indoor futsal competition — Est. 2012",
  openGraph: {
    siteName: "Wagga Futsal",
    type: "website",
  },
};

// The staging site must never be indexed by search engines.
export async function generateMetadata(): Promise<Metadata> {
  const { env } = await runtimeInfo();
  return env === "staging"
    ? { ...baseMetadata, title: { default: "STAGING · Wagga Futsal", template: "STAGING · %s" }, robots: { index: false, follow: false } }
    : baseMetadata;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <EnvBanner />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
