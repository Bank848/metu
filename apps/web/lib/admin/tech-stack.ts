// Curated tech-stack metadata for /admin/tech-stack. Versions read
// from package.json at build time so the table never drifts.
export type TechLayer =
  | "Frontend"
  | "Backend"
  | "Auth"
  | "Database"
  | "Payments"
  | "Security"
  | "Tests"
  | "Build";

export interface TechItem {
  /** Must match the package.json key exactly. */
  name: string;
  layer: TechLayer;
  /** One-line description rendered in the third column of the table. */
  purpose: string;
  /** Official docs / homepage. Opens in a new tab. */
  url: string;
  /**
   * simpleicons slug for the brand logo. Maps to
   * `https://cdn.simpleicons.org/<slug>` (returns SVG).
   * Leave undefined for packages without an obvious brand logo —
   * the UI falls back to the layer's lucide icon.
   */
  iconSlug?: string;
  /** Hex (no #) brand colour used to tint the logo. */
  iconColor?: string;
  /** Friendly display label when `name` reads like an npm package. */
  displayName?: string;
}

export const TECH_STACK: TechItem[] = [
  // ── Frontend ──────────────────────────────────────────────────────
  { name: "next",                     layer: "Frontend", purpose: "App-router React framework + BFF",                  url: "https://nextjs.org",                                       displayName: "Next.js",       iconSlug: "nextdotjs",       iconColor: "ffffff" },
  { name: "react",                    layer: "Frontend", purpose: "UI library",                                        url: "https://react.dev",                                        displayName: "React",         iconSlug: "react",           iconColor: "61DAFB" },
  { name: "react-dom",                layer: "Frontend", purpose: "DOM renderer for React",                            url: "https://react.dev",                                        displayName: "React DOM",     iconSlug: "react",           iconColor: "61DAFB" },
  { name: "tailwindcss",              layer: "Frontend", purpose: "Utility-first CSS",                                 url: "https://tailwindcss.com",                                  displayName: "Tailwind CSS",  iconSlug: "tailwindcss",     iconColor: "06B6D4" },
  { name: "lucide-react",             layer: "Frontend", purpose: "Icon set used across admin + seller dashboards",   url: "https://lucide.dev",                                        displayName: "Lucide",        iconSlug: "lucide",          iconColor: "F56565" },
  { name: "class-variance-authority", layer: "Frontend", purpose: "Tailwind variant API",                              url: "https://cva.style" },
  { name: "clsx",                     layer: "Frontend", purpose: "Conditional className helper",                      url: "https://github.com/lukeed/clsx" },
  { name: "tailwind-merge",           layer: "Frontend", purpose: "Resolve conflicting Tailwind classes",              url: "https://github.com/dcastil/tailwind-merge" },
  { name: "@dagrejs/dagre",           layer: "Frontend", purpose: "Layered graph layout for ER diagram fallback",      url: "https://github.com/dagrejs/dagre" },
  { name: "@sentry/nextjs",           layer: "Frontend", purpose: "Error tracking",                                    url: "https://sentry.io",                                        displayName: "Sentry",        iconSlug: "sentry",          iconColor: "362D59" },

  // ── Backend ───────────────────────────────────────────────────────
  { name: "express",                  layer: "Backend",  purpose: "HTTP framework",                                    url: "https://expressjs.com",                                    displayName: "Express",       iconSlug: "express",         iconColor: "ffffff" },
  { name: "cookie-parser",            layer: "Backend",  purpose: "Reads better-auth session cookie",                  url: "https://github.com/expressjs/cookie-parser" },
  { name: "cors",                     layer: "Backend",  purpose: "Cross-origin gate",                                 url: "https://github.com/expressjs/cors" },
  { name: "morgan",                   layer: "Backend",  purpose: "Request logger",                                    url: "https://github.com/expressjs/morgan" },
  { name: "zod",                      layer: "Backend",  purpose: "Runtime input validation",                          url: "https://zod.dev",                                          displayName: "Zod",           iconSlug: "zod",             iconColor: "3068B7" },
  { name: "leo-profanity",            layer: "Backend",  purpose: "Profanity filter on usernames + reviews",           url: "https://github.com/jojoee/leo-profanity" },
  { name: "dotenv",                   layer: "Backend",  purpose: "Loads .env at process boot",                        url: "https://github.com/motdotla/dotenv",                       displayName: "dotenv",        iconSlug: "dotenv",          iconColor: "ECD53F" },
  { name: "resend",                   layer: "Backend",  purpose: "Receipt email delivery (REST API)",                 url: "https://resend.com",                                       displayName: "Resend",        iconSlug: "resend",          iconColor: "ffffff" },

  // ── Auth ─────────────────────────────────────────────────────────
  { name: "better-auth",              layer: "Auth",     purpose: "Session + Google OAuth + 2FA orchestration",        url: "https://better-auth.com",                                  displayName: "better-auth" },
  { name: "@better-auth/prisma-adapter", layer: "Auth",  purpose: "Prisma store for better-auth",                      url: "https://better-auth.com" },
  { name: "bcryptjs",                 layer: "Auth",     purpose: "Password hashing",                                  url: "https://github.com/dcodeIO/bcrypt.js" },
  { name: "otplib",                   layer: "Auth",     purpose: "TOTP 2FA code verification",                        url: "https://github.com/yeojz/otplib" },

  // ── Database ─────────────────────────────────────────────────────
  { name: "@prisma/client",           layer: "Database", purpose: "Type-safe ORM client",                              url: "https://www.prisma.io",                                    displayName: "Prisma Client", iconSlug: "prisma",          iconColor: "2D3748" },
  { name: "prisma",                   layer: "Database", purpose: "Schema + migrations CLI",                           url: "https://www.prisma.io",                                    displayName: "Prisma",        iconSlug: "prisma",          iconColor: "2D3748" },
  { name: "@faker-js/faker",          layer: "Database", purpose: "Seed data for demo accounts + listings",            url: "https://fakerjs.dev" },

  // ── Payments ─────────────────────────────────────────────────────
  { name: "stripe",                   layer: "Payments", purpose: "Stripe Connect SDK (payments + Connect accounts + payouts + refunds)", url: "https://stripe.com/docs/api?lang=node",         displayName: "Stripe SDK",    iconSlug: "stripe",          iconColor: "635BFF" },
  { name: "@stripe/stripe-js",        layer: "Payments", purpose: "Stripe.js loader for the buyer-side Element",       url: "https://stripe.com/docs/js",                               displayName: "Stripe.js",     iconSlug: "stripe",          iconColor: "635BFF" },
  { name: "@stripe/react-stripe-js",  layer: "Payments", purpose: "Stripe Elements React bindings (PaymentElement)",   url: "https://stripe.com/docs/stripe-js/react",                  displayName: "Stripe Elements", iconSlug: "stripe",        iconColor: "635BFF" },

  // ── Security ─────────────────────────────────────────────────────
  { name: "helmet",                   layer: "Security", purpose: "HTTP security headers (CSP / HSTS / X-Frame-Options)", url: "https://helmetjs.github.io",                              displayName: "Helmet" },

  // ── Tests ────────────────────────────────────────────────────────
  { name: "vitest",                   layer: "Tests",    purpose: "Unit test runner",                                  url: "https://vitest.dev",                                       displayName: "Vitest",        iconSlug: "vitest",          iconColor: "6E9F18" },
  { name: "@vitest/coverage-v8",      layer: "Tests",    purpose: "Coverage instrumentation",                          url: "https://vitest.dev",                                       displayName: "Vitest Coverage", iconSlug: "vitest",        iconColor: "6E9F18" },
  { name: "supertest",                layer: "Tests",    purpose: "Drives Express in-process",                         url: "https://github.com/ladjs/supertest" },
  { name: "@playwright/test",         layer: "Tests",    purpose: "Persona-based E2E smoke",                           url: "https://playwright.dev",                                   displayName: "Playwright",    iconSlug: "playwright",      iconColor: "2EAD33" },

  // ── Build / Tooling ──────────────────────────────────────────────
  { name: "typescript",               layer: "Build",    purpose: "Strict types across the monorepo",                  url: "https://www.typescriptlang.org",                           displayName: "TypeScript",    iconSlug: "typescript",      iconColor: "3178C6" },
  { name: "concurrently",             layer: "Build",    purpose: "Runs web + server in parallel",                     url: "https://github.com/open-cli-tools/concurrently" },
  { name: "tsx",                      layer: "Build",    purpose: "TS dev/seed runner",                                url: "https://github.com/privatenumber/tsx" },
  { name: "autoprefixer",             layer: "Build",    purpose: "PostCSS vendor prefixes",                           url: "https://github.com/postcss/autoprefixer",                  displayName: "Autoprefixer",  iconSlug: "autoprefixer",    iconColor: "DD3735" },
  { name: "postcss",                  layer: "Build",    purpose: "CSS pipeline",                                      url: "https://postcss.org",                                      displayName: "PostCSS",       iconSlug: "postcss",         iconColor: "DD3A0A" },
];

/**
 * The architecture flowchart at the top of /admin/tech-stack groups
 * tech into runtime layers, with arrows showing how data moves between
 * them. This is curated to match what an external observer would say
 * about the system, not 1:1 with the package list above.
 */
export interface FlowchartNode {
  /** simpleicons slug. Falls back to the layer's lucide if absent. */
  iconSlug?: string;
  iconColor?: string;
  label: string;
  /** Optional caption shown under the logo (e.g. "metu.fly.dev"). */
  caption?: string;
}

export interface FlowchartLayer {
  id: string;
  title: string;
  blurb: string;
  /** Tailwind colour key — must exist in the page's accent map. */
  accent: "blue" | "amber" | "emerald" | "purple" | "pink" | "red" | "cyan" | "slate";
  nodes: FlowchartNode[];
}

export const FLOWCHART_LAYERS: FlowchartLayer[] = [
  {
    id: "client",
    title: "Browser",
    blurb: "Buyers and sellers interact with rendered pages and forms.",
    accent: "blue",
    nodes: [
      { iconSlug: "nextdotjs",  iconColor: "ffffff", label: "Next.js",    caption: "App Router" },
      { iconSlug: "react",      iconColor: "61DAFB", label: "React" },
      { iconSlug: "tailwindcss",iconColor: "06B6D4", label: "Tailwind CSS" },
      { iconSlug: "stripe",     iconColor: "635BFF", label: "Stripe.js",  caption: "PaymentElement" },
    ],
  },
  {
    id: "bff",
    title: "BFF · metu.fly.dev",
    blurb: "Server components render pages, route handlers proxy /api calls to the API.",
    accent: "purple",
    nodes: [
      { iconSlug: "nextdotjs",  iconColor: "ffffff", label: "Next.js Server", caption: "Server Components" },
      { iconSlug: "vercel",     iconColor: "ffffff", label: "Middleware",     caption: "Auth + redirects" },
      { iconSlug: "sentry",     iconColor: "362D59", label: "Sentry",         caption: "Error tracking" },
    ],
  },
  {
    id: "api",
    title: "API · metu-api.fly.dev",
    blurb: "Stateless Express service. All business logic lives here behind requireAuth().",
    accent: "amber",
    nodes: [
      { iconSlug: "express", iconColor: "ffffff", label: "Express",     caption: "HTTP framework" },
      { iconSlug: "zod",     iconColor: "3068B7", label: "Zod",         caption: "Validation" },
      { label: "better-auth",                       caption: "Sessions + OAuth + 2FA" },
      { label: "Helmet",                            caption: "Security headers" },
    ],
  },
  {
    id: "data",
    title: "Database",
    blurb: "Prisma is the only client. Migrations + seed live in /packages/db.",
    accent: "emerald",
    nodes: [
      { iconSlug: "prisma",     iconColor: "2D3748", label: "Prisma",     caption: "ORM + migrate" },
      { iconSlug: "postgresql", iconColor: "4169E1", label: "PostgreSQL" },
      { iconSlug: "supabase",   iconColor: "3FCF8E", label: "Supabase",   caption: "Singapore" },
    ],
  },
  {
    id: "external",
    title: "External services",
    blurb: "Money + email + sign-in. We never store card details or send SMTP ourselves.",
    accent: "pink",
    nodes: [
      { iconSlug: "stripe",        iconColor: "635BFF", label: "Stripe Connect", caption: "Payments + payout" },
      { iconSlug: "resend",        iconColor: "ffffff", label: "Resend",         caption: "Transactional email" },
      { iconSlug: "google",        iconColor: "4285F4", label: "Google OAuth",   caption: "Sign-in" },
    ],
  },
  {
    id: "infra",
    title: "Hosting & CI",
    blurb: "Two Fly.io machines (web + api), GitHub for source, Docker base images.",
    accent: "slate",
    nodes: [
      { iconSlug: "flydotio", iconColor: "8B5CF6", label: "Fly.io",  caption: "sin region" },
      { iconSlug: "docker",   iconColor: "2496ED", label: "Docker",  caption: "node:20-alpine" },
      { iconSlug: "github",   iconColor: "ffffff", label: "GitHub",  caption: "main → deploy" },
    ],
  },
];

export const LAYER_ORDER: TechLayer[] = [
  "Frontend",
  "Backend",
  "Auth",
  "Database",
  "Payments",
  "Security",
  "Tests",
  "Build",
];
