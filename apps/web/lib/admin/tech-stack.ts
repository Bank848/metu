/**
 * Phase 21.2 — curated tech-stack metadata for /admin/tech-stack.
 *
 * This list maps every "headline" dependency to a layer label, a one-line
 * purpose, and a link to its docs. Versions are NOT hard-coded — the page
 * cross-references with the live package.json values at build time so the
 * table can never drift from what's actually installed.
 *
 * Anything in package.json that's NOT in this curated list shows up under
 * "Other dependencies" on the page so reviewers can spot helpers + types
 * without cluttering the headline section.
 */
export type TechLayer =
  | "Frontend"
  | "Backend"
  | "Auth"
  | "Database"
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
}

export const TECH_STACK: TechItem[] = [
  // ── Frontend ──────────────────────────────────────────────────────
  { name: "next",                     layer: "Frontend", purpose: "App-router React framework + BFF",                  url: "https://nextjs.org" },
  { name: "react",                    layer: "Frontend", purpose: "UI library",                                        url: "https://react.dev" },
  { name: "react-dom",                layer: "Frontend", purpose: "DOM renderer for React",                            url: "https://react.dev" },
  { name: "tailwindcss",              layer: "Frontend", purpose: "Utility-first CSS",                                 url: "https://tailwindcss.com" },
  { name: "lucide-react",             layer: "Frontend", purpose: "Icon set (Network / Layers / Banknote etc.)",       url: "https://lucide.dev" },
  { name: "qrcode.react",             layer: "Frontend", purpose: "PromptPay QR rendering",                            url: "https://github.com/zpao/qrcode.react" },
  { name: "class-variance-authority", layer: "Frontend", purpose: "Tailwind variant API",                              url: "https://cva.style" },
  { name: "clsx",                     layer: "Frontend", purpose: "Conditional className helper",                      url: "https://github.com/lukeed/clsx" },
  { name: "tailwind-merge",           layer: "Frontend", purpose: "Resolve conflicting Tailwind classes",              url: "https://github.com/dcastil/tailwind-merge" },
  { name: "@sentry/nextjs",           layer: "Frontend", purpose: "Error tracking",                                    url: "https://sentry.io" },

  // ── Backend ───────────────────────────────────────────────────────
  { name: "express",                  layer: "Backend",  purpose: "HTTP framework",                                    url: "https://expressjs.com" },
  { name: "cookie-parser",            layer: "Backend",  purpose: "Reads better-auth session cookie",                  url: "https://github.com/expressjs/cookie-parser" },
  { name: "cors",                     layer: "Backend",  purpose: "Cross-origin gate",                                 url: "https://github.com/expressjs/cors" },
  { name: "morgan",                   layer: "Backend",  purpose: "Request logger",                                    url: "https://github.com/expressjs/morgan" },
  { name: "zod",                      layer: "Backend",  purpose: "Runtime input validation",                          url: "https://zod.dev" },
  { name: "promptpay-qr",             layer: "Backend",  purpose: "Generate Thai PromptPay payloads",                  url: "https://github.com/dtinth/promptpay-qr" },
  { name: "jsqr",                     layer: "Backend",  purpose: "Decode QR from uploaded slip image",                url: "https://github.com/cozmo/jsQR" },
  { name: "pngjs",                    layer: "Backend",  purpose: "PNG decode for slip OCR",                           url: "https://github.com/lukeapage/pngjs" },
  { name: "jpeg-js",                  layer: "Backend",  purpose: "JPEG decode for slip OCR",                          url: "https://github.com/jpeg-js/jpeg-js" },
  { name: "leo-profanity",            layer: "Backend",  purpose: "Profanity filter on usernames + reviews + messages", url: "https://github.com/jojoee/leo-profanity" },
  { name: "dotenv",                   layer: "Backend",  purpose: "Loads .env at process boot",                        url: "https://github.com/motdotla/dotenv" },

  // ── Auth ─────────────────────────────────────────────────────────
  { name: "better-auth",              layer: "Auth",     purpose: "Session + Google OAuth + 2FA orchestration",        url: "https://better-auth.com" },
  { name: "@better-auth/prisma-adapter", layer: "Auth",  purpose: "Prisma store for better-auth",                      url: "https://better-auth.com" },
  { name: "bcryptjs",                 layer: "Auth",     purpose: "Password hashing",                                  url: "https://github.com/dcodeIO/bcrypt.js" },
  { name: "jsonwebtoken",             layer: "Auth",     purpose: "Legacy JWT (pre-Phase 16.3)",                       url: "https://jwt.io" },
  { name: "otplib",                   layer: "Auth",     purpose: "TOTP 2FA code verification",                        url: "https://github.com/yeojz/otplib" },

  // ── Database ─────────────────────────────────────────────────────
  { name: "@prisma/client",           layer: "Database", purpose: "Type-safe ORM client",                              url: "https://www.prisma.io" },
  { name: "prisma",                   layer: "Database", purpose: "Schema + migrations CLI",                           url: "https://www.prisma.io" },
  { name: "@faker-js/faker",          layer: "Database", purpose: "Seed data for demo accounts + listings",            url: "https://fakerjs.dev" },

  // ── Tests ────────────────────────────────────────────────────────
  { name: "vitest",                   layer: "Tests",    purpose: "Unit test runner",                                  url: "https://vitest.dev" },
  { name: "@vitest/coverage-v8",      layer: "Tests",    purpose: "Coverage instrumentation",                          url: "https://vitest.dev" },
  { name: "supertest",                layer: "Tests",    purpose: "Drives Express in-process",                         url: "https://github.com/ladjs/supertest" },
  { name: "@playwright/test",         layer: "Tests",    purpose: "4-persona E2E smoke",                               url: "https://playwright.dev" },

  // ── Build / Tooling ──────────────────────────────────────────────
  { name: "typescript",               layer: "Build",    purpose: "Strict types across the monorepo",                  url: "https://www.typescriptlang.org" },
  { name: "concurrently",             layer: "Build",    purpose: "Runs web + server in parallel",                     url: "https://github.com/open-cli-tools/concurrently" },
  { name: "tsx",                      layer: "Build",    purpose: "TS dev/seed runner",                                url: "https://github.com/privatenumber/tsx" },
  { name: "autoprefixer",             layer: "Build",    purpose: "PostCSS vendor prefixes",                           url: "https://github.com/postcss/autoprefixer" },
  { name: "postcss",                  layer: "Build",    purpose: "CSS pipeline",                                      url: "https://postcss.org" },
];

export const LAYER_ORDER: TechLayer[] = [
  "Frontend",
  "Backend",
  "Auth",
  "Database",
  "Tests",
  "Build",
];
