/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY ⚠️
 *
 * This file is STABLE and WORKING.
 * Do NOT refactor, rename, or change logic without explicit approval.
 *
 * Changes allowed:
 * ✅ Add new fields
 * ❌ Modify existing behavior
 *
 * Last verified: 2026-02-09
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import GlobalUppercaseEnforcer from "@/components/GlobalUppercaseEnforcer";

/**
 * NOTE:
 * Geist is NOT available in stable next/font/google.
 * Inter is used as a safe, production-ready replacement.
 * CSS variable names are intentionally preserved to avoid breaking styles.
 */

const geistSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Inter({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Nexus Logistics",
  description: "Secure delivery and returns management platform.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Nexus Logistics",
    title: "Nexus Logistics",
    description: "Secure delivery and returns management platform.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexus Logistics",
    description: "Secure delivery and returns management platform.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-US">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GlobalUppercaseEnforcer />
        {children}
      </body>
    </html>
  );
}
