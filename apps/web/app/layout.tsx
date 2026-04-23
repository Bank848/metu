import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { CompareDrawer } from "@/components/CompareDrawer";
import { themeBootstrapScript } from "@/components/ThemeToggle";
import { PlausibleScript } from "@/components/PlausibleScript";
import { I18nProvider } from "@/lib/i18n/client";
import { getServerLocale } from "@/lib/i18n/server";

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
  // Set the canonical site URL so Open Graph / Twitter cards resolve absolute
  // image paths and the sitemap helper can derive the same base.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://metu.fly.dev"),
  applicationName: "METU",
  appleWebApp: {
    capable: true,
    title: "METU",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.svg", sizes: "180x180", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    siteName: "METU",
    title: "METU — Digital Marketplace",
    description:
      "Digital marketplace for Thai creators — templates, music, courses, art, and more.",
  },
};

// Browser chrome / iOS status bar tint. Kept separate from `metadata` so
// it lives on the recommended `viewport` export per Next 14 conventions.
export const viewport = {
  themeColor: "#0E0E0E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Read the user's saved locale from cookies so the server-rendered
  // markup ships with the right language and there's no flash of English
  // before the client provider takes over.
  const locale = getServerLocale();
  return (
    <html lang={locale} className={`${display.variable} ${body.variable} ${mono.variable} dark`}>
      <head>
        {/*
          Bootstrap the user's saved theme BEFORE hydration so we never
          flash the wrong palette on hard reload. Runs synchronously in
          the document head, reads localStorage, swaps the html class.
          Tiny inline script — no separate request.
        */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-screen bg-surface-1 text-ink-primary font-body antialiased">
        {/*
          Skip-to-content — first focusable element on every page so
          keyboard + screen-reader users can bypass the TopNav. Hidden
          off-screen until focused, then springs into the top-left
          corner with a brand-yellow pill so it's impossible to miss.
          Pages render their main content inside <main id="main"> so
          this anchor always has a target.
        */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-brand-yellow focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-space-black focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-brand-yellow/60"
        >
          Skip to content
        </a>
        <I18nProvider initialLocale={locale}>
          {children}
          <KeyboardShortcuts />
          <CompareDrawer />
        </I18nProvider>
        <PlausibleScript />
      </body>
    </html>
  );
}
