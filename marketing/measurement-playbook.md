# Measurement Playbook

How to know whether the SEO + content + distribution work is paying off — and what to do about it.

## North-star metric

**Weekly organic sessions to `/docs/*` and `/blog/*`** (Google Analytics 4 → "Organic Search" channel, filtered to `/docs` or `/blog` page paths).

This is the only metric that matters for the first 90 days. Everything else is a leading or lagging indicator.

### Targets

| Period | Weekly organic sessions | Notes |
|---|---|---|
| Week 1–2 (post-launch) | 50–200 | Mostly brand + HN/Reddit residual |
| Month 1 | 300–800 | Compare pages start ranking long-tail |
| Month 3 | 2,000–5,000 | Cornerstone posts indexed, some keyword wins |
| Month 6 | 8,000–20,000 | If you stuck the strategy |

These are realistic, not aspirational. If you're under range at 3 months, diagnose — don't pile on more posts.

## Secondary metrics

| Metric | Source | Why it matters |
|---|---|---|
| Indexed pages | Search Console → Coverage | Are pages getting into Google? |
| Top-10 keyword count | Search Console → Performance | Real ranking momentum |
| Average CTR | Search Console → Performance | Is the SERP entry compelling? |
| Time on page (compare pages) | GA4 → Pages | Are visitors reading or bouncing? |
| Pages per session | GA4 | Internal linking working? |
| Conversion: "Start building" CTA | GA4 → Events → `cta_start_building` | Top-of-funnel → docs |
| GitHub stars per week | GitHub | Brand momentum |
| `npm install @10xscale/agentflow-client` per week | npm stat API | Trial intent |
| `pip install agentflow` per week | pypistats | Trial intent |

## GA4 setup

The gtag plugin is wired in [docusaurus.config.ts](../docusaurus.config.ts) and reads `GOOGLE_ANALYTICS_ID` from the GitHub Actions secret of the same name. To activate:

1. Create a GA4 property at [analytics.google.com](https://analytics.google.com).
2. Copy the **Measurement ID** (format: `G-XXXXXXXXXX`).
3. Add to GitHub repo secrets as `GOOGLE_ANALYTICS_ID`.
4. Re-run the deploy workflow.

### Custom events tracked on the homepage

Wired via [`src/lib/analytics.ts`](../src/lib/analytics.ts) and `onClick` handlers in [`src/pages/index.tsx`](../src/pages/index.tsx):

| Event name | Where it fires | Useful as |
|---|---|---|
| `cta_start_building` | "Start building" hero button | Primary conversion |
| `cta_browse_tutorials` | "Browse tutorials" hero button | Secondary intent |
| `cta_doc_track` | Doc-track cards on homepage | Which path resonates |

To track more events, import `trackEvent` from `@site/src/lib/analytics` and call from any client component.

### Mark events as conversions in GA4

In GA4 → Admin → Events → Mark `cta_start_building` as a conversion. That makes it visible in the standard reports and in the Looker Studio template below.

## Search Console setup

1. Add **agentflow.10xscale.ai** as a property.
2. Verify ownership via DNS TXT record on `10xscale.ai`.
3. Submit `https://agentflow.10xscale.ai/sitemap.xml`.
4. (Optional) Add the GitHub Pages URL as a separate property if you migrated, to track redirects during the cutover.

### URL inspection on key pages

Manually request indexing on the highest-priority URLs the first week:

- `/docs/get-started`
- `/docs/compare/agentflow-vs-langgraph`
- `/docs/compare/agentflow-vs-crewai`
- `/blog/how-to-build-an-ai-agent-in-python`
- `/blog/langgraph-alternatives-5-frameworks`

Don't request-index more than ~10 URLs; sitemap handles the rest.

## Looker Studio dashboard

Build a single dashboard, refresh weekly, share with the team.

### Recommended pages

1. **North star** — weekly organic sessions to `/docs` + `/blog`, with 30-day trendline
2. **Acquisition** — top 20 search queries (impressions, clicks, CTR, position)
3. **Pages** — top 20 pages by organic traffic, time on page, exits
4. **Conversions** — `cta_start_building` event count + funnel (impressions → click → CTA)
5. **Distribution** — referrals from HN, Reddit, Dev.to, awesome-lists

### Connecting data sources

- **GA4 connector**: native in Looker Studio. Filter to `Session medium = organic` and page path `^/docs|^/blog`.
- **Search Console connector**: native. Use the URL property (`https://agentflow.10xscale.ai/`).

A starter Looker template URL convention: `https://lookerstudio.google.com/reporting/<id>/copy?...`. Share the link in a sealed Google Doc once built — don't put the link in this file (it changes when copied).

## Weekly review cadence

Monday morning, 30 minutes:

1. **Open Search Console → Performance.** Look at the last 7 days.
   - Which queries gained 5+ impressions vs. previous week?
   - Which pages broke into top-10 for any query? Note them.
   - Which pages dropped > 20% vs trend? Open in incognito; check for ranking change.

2. **Open GA4 → Acquisition → Traffic acquisition.** Filter to organic.
   - Which pages drove the most sessions?
   - Conversion rate (`cta_start_building` / sessions) — is it above 2%? If lower, the page intent does not match the search intent.

3. **Look at top 5 pages.** Are they the ones you expected? If not, that's information — pivot the next post toward what's working.

4. **One action.** Pick one thing to do this week based on the data. Examples:
   - "Page X ranks #4 for keyword Y. Add 3 internal links to it from related pages → push to #2."
   - "Compare-page CTR is 1.2% (low). Rewrite the meta description with more specific value prop."
   - "No clicks on `cta_browse_tutorials`. Either remove the button or change the copy."

Don't try to do everything every week. One action, executed, beats five plans.

## Monthly deeper-dive

End of each month, 90 minutes:

1. **Keyword wins** — list every keyword that hit top-10 this month. Are there any that should be top-3? Pick one to push (more content, more internal links, refresh the page).
2. **Content audit** — which blog posts drove zero traffic? Either improve or quietly retire.
3. **Backlink check** — has anyone linked? Use Ahrefs / Semrush trial / [search.marginalia.nu](https://search.marginalia.nu) for a free check.
4. **Refresh top 3 pages** — take the 3 highest-traffic pages and update them. Add a section, fix any code that rotted, bump the modified date. Google rewards freshness on cornerstone content.

## Red flags that mean stop and diagnose

| Signal | Likely cause |
|---|---|
| Indexed pages stuck < 50 after 30 days | robots.txt / canonical / sitemap misconfigured |
| Average position > 50 | Pages not relevant to queries; reposition or rewrite |
| Bounce rate > 80% on cornerstone posts | Title/description mismatch with content; check intent |
| `cta_start_building` rate < 1% | CTA copy or position is wrong |
| Organic sessions flat for 60+ days | Content is right but visibility is missing — push backlinks (Part E) |

## Tooling stack we recommend

- **Google Analytics 4** — required, free
- **Google Search Console** — required, free
- **Microsoft Clarity** — free heatmaps + session replay (already wired in [`Root.tsx`](../src/theme/Root.tsx) when `MICROSOFT_CLARITY_ID` is set)
- **Looker Studio** — free dashboards
- **Ahrefs / Semrush** — paid; one trial month at month 3 is enough for backlink + competitor checks
- **pypistats** + **npm-stat** — free Python and npm download stats

## Don't

- **Don't track everything.** A dashboard with 30 metrics is unread. Five metrics, weekly.
- **Don't measure too early.** First useful signal is at week 6, not week 2.
- **Don't compare to AHREFS estimates.** They're guesses. Search Console is truth.
- **Don't optimize for vanity metrics.** GitHub stars feel good but PyPI downloads are closer to revenue.

## Final note

Most teams over-invest in Part D content and under-invest in Parts A and E. The scoreboard 6 months in is usually:

| Effort | Impact on organic traffic |
|---|---|
| Technical SEO (Part A) | 30% |
| On-page + comparison pages (Parts B + C) | 35% |
| Cornerstone blog (Part D) | 20% |
| Off-page distribution (Part E) | 15% |

That last 15% is what compounds. Don't skip it.
