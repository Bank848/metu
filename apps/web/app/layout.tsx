import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "METU — Digital Marketplace",
  description:
    "METU is the digital marketplace for Thai creators. Templates, music, courses, art — sell and buy without ever shipping a thing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} dark`}>
      <body className="min-h-screen bg-surface-1 text-ink-primary font-body antialiased">
        {children}
      </body>
    </html>
  );
}
