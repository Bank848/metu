import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Manrope, JetBrains_Mono, Prompt } from "next/font/google";
import "./globals.css";
import { LayoutClientIslands } from "@/components/LayoutClientIslands";
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

const thai = Prompt({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "METU — Digital Marketplace",
  description:
    "METU is the digital marketplace for Thai creators. Templates, music, courses, art — sell and buy without ever shipping a thing.",
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

export const viewport = {
  themeColor: "#0E0E0E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getServerLocale();
  return (
    <html lang={locale} className={`${display.variable} ${body.variable} ${mono.variable} ${thai.variable} dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-screen bg-surface-1 text-ink-primary font-body antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-brand-yellow focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-space-black focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-brand-yellow/60"
        >
          Skip to content
        </a>
        <I18nProvider initialLocale={locale}>
          {children}
          <LayoutClientIslands />
        </I18nProvider>
        <PlausibleScript />
      </body>
    </html>
  );
}
