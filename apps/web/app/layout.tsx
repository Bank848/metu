import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "METU — Digital Marketplace",
  description:
    "METU is a marketplace for Thai digital creators. Templates, music, courses, art — sell and buy without ever shipping a thing. (CPE241 · KMUTT · Group 8)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-space-black text-ink-primary font-body antialiased">
        {children}
      </body>
    </html>
  );
}
