# UI Redesign Plan — AgentFlow Docs Marketing Pages

## Context

The site ships fine for SEO but the UI reads as generic 2023 Docusaurus: blurred orbs, grid-backdrop hero, empty gradient blocks where icons should be, raw unhighlighted code, no real product visuals, no social proof. The information architecture is right; the surface needs work.

**Direction**: Modern dark dev-tool (Resend-style). Dense, code-forward, real product visuals, monospace accents, generous typography hierarchy.

**Scope**: Marketing pages only — homepage, compare pages, use-case pages, integration pages. Docs reading experience stays on Docusaurus defaults (sidebar, table of contents, default code blocks). This keeps blast radius small and ship time short.

**Assets in hand**: Logo / wordmark exists, blue (`#2563eb`) primary stays, Inter stays. We need real icons and basic product illustrations.

**Reference**: [resend.com](https://resend.com) — for the hero code block as a design element, the dense feature cards with real icons, the dark-first treatment, and the compact dev-tool typography rhythm.

---

## Part U1 — Visual system (Day 1, ~3 hrs)

### U1.1 Make dark the canonical theme

Today: `defaultMode: 'dark'` is set ([docusaurus.config.ts:97](docusaurus.config.ts)) but the marketing CSS palette is light-first with a dark override. We'll flip:

- Design tokens defined dark-first in `:root`
- Light overrides under `[data-theme='light']` (we still support the toggle, just don't optimize for it)
- Body background: deep near-black (`#0a0e1a`) with subtle gradient, not the current radial-orbs

Tokens to add:

```css
--af-bg-0:        #060a14;   /* page background */
--af-bg-1:        #0d1320;   /* surface */
--af-bg-2:        #131a2b;   /* elevated surface */
--af-border:      rgba(148, 163, 184, 0.14);
--af-border-hi:   rgba(148, 163, 184, 0.28);
--af-text:        #e2e8f0;
--af-text-dim:    #94a3b8;
--af-text-faint:  #64748b;
--af-blue:        #2563eb;   /* unchanged — brand */
--af-blue-glow:   #3b82f6;
--af-violet:      #8b5cf6;   /* accent only */
--af-amber:       #f59e0b;   /* warnings, "production" feel */
--af-mono:        "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
--af-glow-blue:   0 0 0 1px rgba(59, 130, 246, 0.3), 0 8px 24px rgba(59, 130, 246, 0.18);
```

### U1.2 Typography refinement

Keep Inter for body. Add **JetBrains Mono** for code and monospace accents (eyebrows, label tags). Inter Display weights for the largest headlines.

- Add `@fontsource/inter` and `@fontsource/jetbrains-mono` as deps (offline-safe, no Google Fonts request)
- Headline scale: H1 clamp(3rem, 6vw, 5rem), tighter line-height (0.95), tighter letter-spacing (-0.04em)
- Body: 16px, line-height 1.7, slightly looser than Resend so docs stay readable
- Eyebrow: 0.7rem, uppercase, JetBrains Mono, letter-spacing 0.18em

### U1.3 Components to retire

- ✗ Blurred orbs (`.heroOrb--one`, `.heroOrb--two`) — overused
- ✗ Grid-line hero background (`hero--agentflow::before`) — Linear cliché
- ✗ Empty gradient `<div>` "icons" in HomepageFeatures — will replace with real Lucide icons
- ✗ The current "Connected stack" text card — replaced by an animated package-map diagram

### U1.4 Components to introduce

- `<Icon name="..." />` — typed wrapper over Lucide React
- `<TerminalBlock>` — dark code block with traffic-light header, syntax highlighting, optional copy button
- `<LogoWall>` — provider/integration logo strip
- `<Marquee>` — slow horizontal scroll for logos / quotes (CSS-only, no library)
- `<StatsBar>` — GitHub stars + npm downloads + PyPI downloads
- `<CodeSwitcher>` — tabs that swap "Same agent in {framework}" code samples
- `<GlowCard>` — feature card with icon + title + description + subtle hover glow

Critical files to create:
- [src/components/Icon/index.tsx](src/components/Icon/index.tsx)
- [src/components/TerminalBlock/index.tsx](src/components/TerminalBlock/index.tsx)
- [src/components/LogoWall/index.tsx](src/components/LogoWall/index.tsx)
- [src/components/Marquee/index.tsx](src/components/Marquee/index.tsx)
- [src/components/StatsBar/index.tsx](src/components/StatsBar/index.tsx)
- [src/components/CodeSwitcher/index.tsx](src/components/CodeSwitcher/index.tsx)
- [src/components/GlowCard/index.tsx](src/components/GlowCard/index.tsx)

---

## Part U2 — Homepage redesign (Days 1–2, ~6 hrs)

New section order:

```
1. Hero                         (left: copy + CTAs;  right: terminal-style code block with highlighting)
2. Stats bar                    (GitHub stars · npm downloads · PyPI downloads · MIT license)
3. Logo wall — "Works with"     (OpenAI, Anthropic, Google, Vertex AI, Postgres, Redis, FastAPI, Next.js)
4. "Same agent, every framework" — CodeSwitcher tabs (AgentFlow / LangGraph / CrewAI / AutoGen / Google ADK)
5. Three feature pillars        (real icons — orchestration, persistence, deployment)
6. "From local to production"   (4-step journey, redesigned with iconography)
7. Animated package-map diagram (Python lib → API → TS client → playground)
8. "Why teams switch" — quote/scenario cards
9. Final CTA                    ("Get started in 5 minutes" + GitHub stars button)
```

### U2.1 Hero rewrite

Current hero shows raw `<pre><code>` text. New version:

- Left column: keep H1 + H2 + lede + CTAs but tighten spacing
- Right column: `<TerminalBlock>` rendering the quickstart in actual Prism syntax highlighting
- Below the terminal: a small `<TerminalBlock>` titled `bash` showing `pip install agentflow 10xscale-agentflow-cli` with a copy button
- No orbs, no grid background — replace with a single very subtle gradient mesh that respects the brand blue
- Eyebrow becomes a real status pill: `▲ v1.0 · MIT · Python 3.10+`

### U2.2 Stats bar

A single-line strip below the hero. Pulls live numbers via shields.io badges (cached, no client-side fetch needed):

```
⭐ 2.1k GitHub stars     📦 12k npm/week     🐍 8k PyPI/week     ⚖️ MIT
```

Badge URLs from shields.io are public CDN-cached SVGs — fast and no API key required.

### U2.3 Logo wall

A horizontal `<Marquee>` of provider/integration logos. We need 8–12 SVGs in `static/img/logos/`:

- OpenAI, Anthropic, Google, Vertex AI, Mistral
- Postgres, Redis, Qdrant, pgvector
- FastAPI, Next.js, Vercel, AWS, Docker

Most are available under MIT/CC-0 from official press kits. The plan includes a one-time download step.

### U2.4 "Same agent, every framework" CodeSwitcher

This is the SEO-critical section. Tabs at the top, code below:

```
[AgentFlow]  [LangGraph]  [CrewAI]  [AutoGen]  [Google ADK]
```

Clicking a tab swaps the code block to show the same ReAct agent in that framework. Each tab also shows a tiny "lines of code" badge so the visual win lands instantly.

### U2.5 Feature pillars with real icons

Replace [src/components/HomepageFeatures](src/components/HomepageFeatures) cards:

| Pillar | Lucide icon | Body |
|---|---|---|
| Graph orchestration | `network` | Typed StateGraph, conditional edges, sub-graphs, recursion limits |
| Production persistence | `database-zap` | InMemoryCheckpointer for dev, PgCheckpointer (Postgres + Redis) for prod |
| Backend → frontend | `unplug` | Built-in REST + SSE server, typed TS client, hosted playground |

Each card glows blue on hover; the icon sits in a square gradient tile with the same blue glow ring.

### U2.6 Package-map diagram

Static SVG (or React-rendered) showing the four packages and how they connect:

```
   agentflow                          @10xscale/agentflow-client
   (Python lib)  ───►  agentflow-cli  ───►  (TypeScript)
                       (REST + SSE)
                            │
                            ▼
                       agentflow-playground
                       (hosted UI)
```

Shipped as inline SVG so it scales crisp at any size. No external dependency.

---

## Part U3 — Compare / use-case / integration page polish (Day 3, ~3 hrs)

### U3.1 Restyle `<CompareTable>`

Current table is functional but flat. Updates:

- Dark-first borders and backgrounds
- "Win" cells get a faint blue gradient + "▲" indicator instead of just a colour shift
- Logo of competitor in the column header (e.g., LangGraph wordmark) using the same logo set as the homepage
- Sticky first column on mobile so the dimension label stays visible while scrolling

### U3.2 Restyle `<FAQ>`

- Dark accordion with smooth expand/collapse
- "+" rotates to "×" on open
- Subtle border-glow on hover

### U3.3 Restyle `<RelatedDocs>`

- Switch to 2-column grid on desktop, stacked on mobile
- Each item gets a small chevron icon and an "intent" tag (concept, tutorial, reference)

### U3.4 Add `<Callout>` MDX component

Five variants: `info` (blue), `tip` (green), `warning` (amber), `danger` (red), `note` (neutral). Replace the few inline `:::note` blocks in compare pages where prose admonitions read better.

### U3.5 Compare page hero polish

Add a small banner at the top of each compare page:

```
[AgentFlow logo] vs [Competitor logo]
"<one-line takeaway>"
```

The competitor logos come from the same `static/img/logos/` set.

---

## Part U4 — Docs page (light touch only)

Per scope, the docs reading experience stays on Docusaurus defaults. The only changes:

- The CSS tokens above also apply to docs pages (they share the same `--ifm-*` and `--af-*` variables), so the colour palette propagates for free
- Docs code blocks pick up the new mono font automatically via `--ifm-font-family-monospace`
- We do **not** swizzle DocSidebar, DocPage, TOC, or admonitions

If you decide later that docs chrome also needs work, it's a separate sprint.

---

## Part U5 — Performance & accessibility checks

Before shipping:

- **Lighthouse desktop**: target ≥ 95 on Performance, 100 on Accessibility, SEO unchanged (already 100)
- **Cumulative Layout Shift**: stays ≤ 0.05 (the marquee and stats bar are the risk areas — reserve space)
- **Largest Contentful Paint**: aim ≤ 1.8s — the hero terminal block is the LCP element
- **Reduced motion**: `prefers-reduced-motion: reduce` disables the marquee scroll and the gradient mesh animation
- **Colour contrast**: AA on all body text, AAA on hero headlines
- **Font loading**: `font-display: swap` plus preloading the Inter weight used in H1

---

## Part U6 — Sequencing

| Day | Deliverable |
|---|---|
| **Day 1** | Visual system tokens, font setup, retire orbs/grid, install `lucide-react` and `@fontsource/*`, build `<Icon>` and `<TerminalBlock>` components |
| **Day 2** | Homepage rewrite: new hero with real syntax highlighting, stats bar, logo wall, feature pillars with real icons |
| **Day 3** | `<CodeSwitcher>` for "Same agent, every framework" + package-map SVG + final CTA section |
| **Day 4** | Compare/use-case/integration polish: `<CompareTable>` restyle, `<FAQ>` restyle, `<RelatedDocs>` restyle, `<Callout>` component |
| **Day 5** | QA: Lighthouse, accessibility, CLS audit; reduced-motion handling; cross-browser check; ship |

Total realistic effort: **3–5 working days**. Most of the leverage is in Day 1–2 (system + hero).

---

## Critical files to create or modify

**Tokens & global**
- [src/css/custom.css](src/css/custom.css) — full rewrite of token block, retire `.heroOrb`, `.hero--agentflow::before` grid
- [src/css/tokens.css](src/css/tokens.css) — new file, single source of truth for design tokens
- [src/css/typography.css](src/css/typography.css) — new file, font loading + scale

**Components (new)**
- [src/components/Icon/](src/components/Icon/) — Lucide wrapper
- [src/components/TerminalBlock/](src/components/TerminalBlock/) — dark code block with traffic-light header
- [src/components/LogoWall/](src/components/LogoWall/) — provider logo strip
- [src/components/Marquee/](src/components/Marquee/) — CSS-only horizontal scroll
- [src/components/StatsBar/](src/components/StatsBar/) — GitHub / npm / PyPI badges
- [src/components/CodeSwitcher/](src/components/CodeSwitcher/) — framework-tab code switcher
- [src/components/GlowCard/](src/components/GlowCard/) — feature card with icon + glow
- [src/components/Callout/](src/components/Callout/) — MDX admonition styled to brand
- [src/components/PackageMap/](src/components/PackageMap/) — SVG diagram of the four packages

**Components (modify)**
- [src/components/HomepageFeatures/](src/components/HomepageFeatures/) — replace empty gradient icons with `<Icon>`, restyle to GlowCard
- [src/components/CompareTable/](src/components/CompareTable/) — dark-first restyle, win-cell indicator, competitor logo header
- [src/components/FAQ/](src/components/FAQ/) — dark accordion polish
- [src/components/RelatedDocs/](src/components/RelatedDocs/) — 2-column grid + intent tag
- [src/pages/index.tsx](src/pages/index.tsx) — full homepage rebuild around new sections

**MDX integration**
- [src/theme/MDXComponents.tsx](src/theme/MDXComponents.tsx) — register `<Callout>`, `<TerminalBlock>` for use in compare/use-case/integration pages

**Static assets**
- `static/img/logos/` — 8–12 SVG logos (OpenAI, Anthropic, Google, Vertex AI, Mistral, Postgres, Redis, Qdrant, FastAPI, Next.js, Vercel, AWS, Docker). Sourced from official press kits, CC-0 / public.
- `static/img/og/` — per-page OG images for compare pages (one per competitor) — optional, can defer

**Dependencies (new)**
```json
{
  "lucide-react": "^0.454.0",
  "@fontsource/inter": "^5.1.0",
  "@fontsource/jetbrains-mono": "^5.1.0"
}
```

No `framer-motion` — keep bundle small. Use CSS transitions for hover, intersection observer + CSS for scroll reveals.

---

## Verification

After each part:

1. **Part U1**: tokens propagate (run dev server; toggle theme; confirm dark + light both readable). No visual regressions in docs pages.
2. **Part U2**: homepage Lighthouse ≥ 95 perf / 100 a11y; LCP ≤ 1.8s; click every CTA, GA event fires; verify on Chrome / Safari / Firefox.
3. **Part U3**: open every compare/use-case/integration page; tables and FAQ behave; mobile sticky-column works; admonitions render in MDX.
4. **Part U4 / U5**: full Lighthouse pass; `prefers-reduced-motion` test; keyboard nav across hero CTAs and code switcher tabs.
5. **Final**: `npm run build` clean, no broken links, audit still passes, deploy preview shared for sign-off.

---

## What I will not do without sign-off

- Change the docs reading experience (sidebar, TOC, doc-page chrome)
- Add framer-motion or other heavy animation libraries
- Replace the existing logo/wordmark
- Change the brand blue or font family
- Touch the SEO front-matter or comparisons content (text stays; only design changes)

If any of those need to flex during implementation, I'll surface the question instead of changing it.
