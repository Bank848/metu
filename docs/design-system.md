# METU Design System Playbook

> Phase 9, Wave 1 — written by the `design-system-builder` agent.
> Foundation only: tokens, classes, motion. No app-page or component
> changes here — those land in Wave 2.

This document is the **single source of truth** for visual decisions on
the METU marketplace. If you're a Wave-2 agent (ProductCard refactor,
home-page rebuild, etc.) read this first and then refactor against the
new tokens. The naming is deliberate — flat, accent, editorial — so
greppers can find every consumer.

---

## 1. Why this exists (the AI-tells we are killing)

The audit identified eight visual habits that scream "AI-generated UI":

| # | Tell                                                       | Where it bites today                                                  | Antidote in this playbook            |
| - | ---------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------ |
| 1 | `.glass-morphism` on every surface                         | `globals.css:134-139`, used 60+ times across cards/nav/dialogs        | `.surface-flat` for grid cards       |
| 2 | Yellow/gold as the only accent                             | `tailwind.config.ts:11-37` — every accent collapses to one hue family | `mint` + `coral` secondary/tertiary  |
| 3 | Identical `rounded-2xl` and `rounded-pill` on everything   | `ProductCard.tsx:42`, `page.tsx:153,207,239`, `GlassButton.tsx:35`    | Radius scale w/ usage rules (§4)     |
| 4 | Lucide icons everywhere; no custom illustration            | Every page imports from `lucide-react`                                | `components/illustrations/` (§7)     |
| 5 | Symmetric `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`      | `page.tsx:126`, `page.tsx:148`, `page.tsx:202`                        | Editorial breakouts (§5)             |
| 6 | Tag chips below every title                                | `ProductCard.tsx:89-97`                                               | Demote to hover or remove (Wave 2)   |
| 7 | Gold hairline as a "watermark" on every section            | `ProductCard.tsx:75`, `page.tsx:167,219`                              | Use only on hero / feature cards     |
| 8 | Stat cards all identical                                   | `page.tsx:99-102` — 4 identical StatCards                             | Asymmetric stat layout (Wave 2)      |

**Reference benchmark:** `github.com/N0M3KM/metu-platform` does NOT
eliminate glassmorphism — they pair it with flat surfaces. We do the
same. The goal is not "less glass," it is "glass used once, where it
earns its complexity."

---

## 2. Palette

### 2.1 Primary (unchanged — do not rename)

The `metu-yellow` family stays exactly as it is. Renaming would force a
60-file refactor and break every existing consumer. We extend, never
replace.

```
metu.yellow      #FFCC00   primary brand, CTA, focus rings
metu.yellowDim   #ECB200   pressed / dim state
metu.gold        #B26800   gradient stop, accent shadows
metu.goldDeep    #3D2B00   text on gold, deep accents
metu.red         #FF2C2C   destructive only — do NOT use as accent
```

### 2.2 Secondary — `mint` (NEW)

```
mint.DEFAULT  #6EE7B7   secondary accent — success, "live", positive deltas
mint.dim      #34D399   pressed / borders
mint.deep     #047857   text on mint, deep variants
```

**Why mint over cyan?** Cyan (`#67E8F9`) on a warm gold-dominant page
reads as "AI tech demo" — the exact aesthetic we are running from. Mint
is analogous-cool against gold's warmth, registers as a different
emotional register (organic / fresh / safe), and carries enough
saturation to survive the dark `surface-1` background. It also doubles
as our success state, retiring `green-500/15` from `Badge.tsx:13`.

### 2.3 Tertiary — `coral` (NEW)

```
coral.DEFAULT  #FB7185   tertiary accent — highlights, "new", soft alerts
coral.dim      #F43F5E   pressed / borders
coral.deep     #881337   text on coral, deep variants
```

**Why coral over rust?** Rust (`#F97316`) is too close in hue to
`metu-gold #B26800` — they fight on the same page. Coral lives at the
opposite end of the warm spectrum, gives us a third *distinct* accent,
and crucially does NOT collide with `metu-red #FF2C2C` (destructive).
Coral = soft / inviting, red = stop / danger. Keep them separate.

### 2.4 Surface + ink (unchanged)

`surface.{1,2,3,4,5}` and `ink.{primary,secondary,dim,mute}` stay as-is.
Light-mode overrides in `globals.css:26-83` continue to work.

---

## 3. Typography

### 3.1 Family stack

```
font-display   Plus Jakarta Sans   headings, hero, totals
font-body      Manrope             body, paragraphs, UI labels
font-thai      Prompt              Thai text (NEW — wired in §6)
font-mono      JetBrains Mono      code, IDs, copy-to-clipboard fields
```

**Why Prompt for Thai?** The friend's reference uses it, and rendering
Thai script in Plus Jakarta Sans produces font-substitution wobble
(some glyphs jump baseline). Prompt is designed by Cadson Demak in
Bangkok — it pairs cleanly with Latin Plus Jakarta and ships free via
Google Fonts. Wave-2 agents should apply `font-thai` conditionally
(e.g. `<span lang="th" className="font-thai">…</span>`) rather than
flipping the whole `<html>` family — mixing Latin in the Thai font
looks worse than mixing Thai in Latin.

### 3.2 Type scale

These are guidelines, not Tailwind tokens (Tailwind's defaults already
cover the values). Use the names below in code review to keep
hierarchy legible.

| Slot       | Tailwind                               | Use                                   |
| ---------- | -------------------------------------- | ------------------------------------- |
| display-1  | `text-7xl md:text-8xl font-black`      | Hero headline (one per page max)      |
| display-2  | `text-5xl md:text-6xl font-extrabold`  | Section landing pages                 |
| display-3  | `text-4xl md:text-5xl font-extrabold`  | Editorial breakouts                   |
| h1         | `text-3xl md:text-4xl font-extrabold`  | Page title                            |
| h2         | `text-2xl md:text-3xl font-bold`       | Section title (e.g. "Trending now")   |
| h3         | `text-xl font-bold`                    | Card title, dialog title              |
| h4         | `text-lg font-semibold`                | Sub-section, sidebar group            |
| body-lg    | `text-lg`                              | Hero subhead, large CTA copy          |
| body       | `text-base`                            | Default                               |
| body-sm    | `text-sm`                              | Captions, meta, helper text           |
| body-xs    | `text-xs`                              | Badges, micro-labels                  |

**Don't** apply `font-display` to body copy — it loses its identity.
Restrict to h3+ and feature numbers (price, totals, stat values).

### 3.3 Progressive scaling

Use `md:` and `lg:` breakpoints to *grow* type, never shrink. The
friend's reference relies on this — small mobile, oversized desktop.
Hero today (`page.tsx:75`) does this correctly; cards do not yet.

---

## 4. Radius scale

Tailwind's defaults already give us `rounded-{none,sm,md,lg,xl,2xl,3xl,full}`.
We add `pill: 118px` (already present) and document the rules:

| Token       | Px        | Where to use                                       |
| ----------- | --------- | -------------------------------------------------- |
| `none`      | 0         | Editorial breakouts, full-bleed images, hero edge  |
| `sm`        | 2         | Inline tags, chips inside dense lists              |
| `md`        | 6         | Inputs, small buttons (`size="sm"`)                |
| `lg`        | 8         | Default inline element, secondary cards            |
| `xl`        | 12        | Standard card (ProductCard, StoreCard)             |
| `2xl`       | 16        | Modals, large feature cards, dialogs               |
| `3xl`       | 24        | Hero panels, oversized callouts (rare)             |
| `pill`      | 118       | CTAs, primary buttons, filter chips                |

**The mistake to avoid:** picking `rounded-2xl` for everything and
`rounded-pill` for everything else creates visual monotony. Mix two or
three from the scale on every page so the grid breathes.

---

## 5. Surface variants

Five surface treatments, each with a CSS class. **`.glass-morphism`
stays.** We add four new ones so consumers can pick the right tool.

| Class               | Background                                          | When to use                                              |
| ------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| `.surface-flat`     | `surface-2` solid, 1px hairline border              | **Default for grid cards.** Cheap, no blur, no halo.     |
| `.surface-accent`   | mint or coral tint over `surface-2`                 | Feature variant — one per row max. Signals "look here."  |
| `.glass-morphism`   | (existing) blurred translucent                      | Overlays only — TopNav, modals, drawers, hover-cards.    |
| `.surface-hero`     | `vibrant-mesh` gradient + star field                | Hero sections, landing-page banners.                     |
| `.surface-editorial`| Full-bleed image / oversized type, no border        | Magazine-style breakouts inside long pages.              |

**Editorial rule of thumb:** if you have 8 cards in a grid, 7 are
`.surface-flat` and 1 is `.surface-accent` (or `.surface-editorial`).
That's the rhythm that kills the AI-grid feel.

### 5.1 Why `.surface-flat` instead of just removing `.glass-morphism`

Removing `.glass-morphism` from grid cards is a 60-file diff and
breaks dark/light parity (light mode has its own override at
`globals.css:60-67`). `.surface-flat` is a drop-in replacement — same
border radius, same padding, but a flat solid surface that costs
zero GPU per scroll frame.

---

## 6. Motion

### 6.1 Library decision

**No Framer Motion.** Framer ships ~30 kB gzipped. We need three
primitives total:

1. Fade-in-up on scroll-into-view
2. Stagger for grid children
3. Hover lift (`-translate-y-1`)

CSS keyframes + a tiny IntersectionObserver hook do all three for
~600 bytes. The friend's reference uses Framer because they have
custom star animations and the rotating Jupiter — we already have
those done in CSS (`stars-md`, `stars-high-density`,
`@keyframes border-spin`).

If a future Wave wants page transitions, layout animations, or
gesture-driven interactions, **then** install Framer. Not before.

### 6.2 Primitives (added to `globals.css`)

```
@keyframes fade-in-up    /* already exists */
@keyframes stagger-rise  /* NEW — same shape, longer duration for staggers */
@keyframes lift-hover    /* utility-class style, used via group-hover */
```

For staggered grid reveals, use the existing `animate-fade-in-up` with
inline `style={{ animationDelay: \`${i * 60}ms\` }}` — Wave-2 agents
should add a tiny `<RevealOnView>` wrapper if they want this on more
than 2-3 places.

### 6.3 Reduced-motion

`globals.css:97-108` already kills all animation for users with
`prefers-reduced-motion: reduce`. Any new keyframe inherits that block
automatically — no extra work needed.

---

## 7. Custom illustration

**Source: hand-rolled SVG**, dropped under
`apps/web/components/illustrations/`. Each file exports a single
React component that accepts `className` so consumers can size + tint.

**Why not unDraw / Storyset?** Both are excellent libraries but the
visual language is "startup landing page 2021" — exactly the tells we
are running from. Hand-rolled SVG (kept tiny — 2-3 illustrations max
for now) gives us a distinctive look at near-zero bundle cost.

Suggested first three:

1. `EmptyCart.tsx` — replaces lucide `ShoppingBag` in cart empty-state
2. `NoResults.tsx` — for search empty state
3. `Marketplace.tsx` — for the home-page hero (Wave 2 may use this in
   place of, or alongside, the existing CSS-Jupiter)

A Wave-2 agent should size them at `120-180px` width, tint with
`text-mint` or `text-coral`, and let SVG `currentColor` inherit.

---

## 8. Shadow scale (NEW tokens)

The current shadows (`card`, `pop`, `glow`, `gold`) are tightly
coupled to the gold accent. We add an elevation scale so non-gold
contexts have something to use.

| Token      | Visual                          | Use                                  |
| ---------- | ------------------------------- | ------------------------------------ |
| `flat`     | `0 1px 0 rgba(0,0,0,0.4)`       | Subtle, just enough to lift off bg   |
| `raised`   | `0 6px 20px -8px rgba(0,0,0,0.55)` | Default card on hover                |
| `floating` | `0 18px 40px -16px rgba(0,0,0,0.7)` | Modals, popovers                     |
| `glow`     | (existing) yellow ring          | Focus / primary CTA hover            |

---

## 9. Do's and Don'ts (with file:line refs to refactor)

### Do

- **Do** use `.surface-flat` on grid cards. See `ProductCard.tsx:42`
  for the offender — replace `glass-morphism` with `surface-flat`.
- **Do** mix radii within a section. Hero CTA = `rounded-pill`, feature
  card = `rounded-2xl`, inline tag = `rounded-md`.
- **Do** use `mint` for "live", "in stock", "new" states.
  `Badge.tsx:13` `success` should switch from `green-500` to `mint`.
- **Do** use `coral` for soft alerts, "limited time", "trending up".
- **Do** reserve `font-display` for h3+ and headline numbers.

### Don't

- **Don't** use `.glass-morphism` on cards inside lists. See
  `ProductCard.tsx:42`, `page.tsx:153`, `page.tsx:207`, `page.tsx:239`
  for the four offenders to refactor.
- **Don't** add the gold hairline (`bg-gradient-to-r ... via-metu-yellow`)
  to every card. See `ProductCard.tsx:75`, `page.tsx:167`, `page.tsx:219`
  — keep it on the hero card only.
- **Don't** use `metu-red` as a generic accent. It's destructive only
  (delete confirmations, danger badges).
- **Don't** stack `rounded-2xl` cards in a `grid-cols-4` without at
  least one `rounded-none` or oversized editorial breakout.
- **Don't** install Framer Motion (yet). Use the CSS keyframes in §6.
- **Don't** rename any existing color token. Add new ones.

---

## 10. Component handoff matrix (for Wave 2 agents)

| Component                          | Today                                | Wave-2 should use                            |
| ---------------------------------- | ------------------------------------ | -------------------------------------------- |
| `ProductCard.tsx`                  | `.glass-morphism` everywhere         | `.surface-flat` (default), gold hairline OFF |
| `page.tsx Hero`                    | star field + CSS Jupiter             | KEEP — this is the right surface             |
| `page.tsx FeaturedStores`          | `.glass-morphism` cards              | `.surface-flat` + 1 `.surface-accent`        |
| `page.tsx CategoryTiles`           | identical glass tiles                | Mix radii: 1× `rounded-3xl`, rest `rounded-xl` |
| `page.tsx WhyMetu`                 | 3 identical glass cards              | 1× `.surface-accent` (mint), 2× `.surface-flat` |
| `StatCard`                         | 4 identical                          | First card oversized; use `font-display` for value |
| `Badge.tsx` `success` variant      | `green-500/15`                       | `mint` token                                 |
| `Badge.tsx` `info` variant         | `blue-500/15`                        | Replace blue with `mint` (consolidates accents) |
| `GlassButton.tsx`                  | `rounded-pill` always                | Add `radius` prop: `pill` (default), `xl`, `md` |
| Empty states (cart, search)        | lucide icon                          | SVG illustration from `components/illustrations/` |

---

## 11. Light-mode caveat

All new classes (`.surface-flat`, `.surface-accent`, `.surface-editorial`,
`.surface-hero`) MUST have a `html.light` override in `globals.css` so
they don't break the existing light theme. This playbook ships the
overrides — Wave-2 agents inherit them for free.

The `mint` and `coral` accent colors do not need light-mode overrides;
they read well on both `#fafafa` (light surface-1) and `#0e0e0e` (dark
surface-1) at the chosen saturation.

---

## 12. Versioning

This is v1.0 of the playbook. If a Wave-2 agent discovers a needed
variant that isn't here, **add it to this file** in the same PR rather
than inventing tokens inline. Drift between docs and code is how
design systems die.
