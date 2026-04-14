---
date: 2026-04-13
topic: seo-optimization
focus: How do I optimize for SEO?
---

# Ideation: SEO Optimization

## Codebase Context

- **Project:** jDuel — real-time multiplayer trivia game
- **Frontend:** React 19 + Vite SPA, TypeScript, Material-UI v7, react-router-dom (client-side routing only)
- **Backend:** FastAPI (Python 3.13), nginx on Oracle VPS (static file serving)
- **Key SEO gaps identified:**
  - `index.html` has no meta description, no Open Graph tags, no Twitter Card tags
  - Page title is the bare string "jDuel" with no keyword context
  - No `robots.txt` or `sitemap.xml` in `public/`
  - No structured data (JSON-LD) of any kind
  - No SSR or build-time prerendering
  - Ephemeral routes (`/room/:code`, `/game/:roomId`) would waste crawl budget if indexed
  - `AboutPage.tsx` exists but contains no search-intent language
- **Primary distribution channel:** Players sharing `/room/:code` links in group chats (Discord, Slack, iMessage) — social link previews matter more than traditional search rankings for this app
- **Past learnings:** No prior SEO work documented in `docs/solutions/`

## Ranked Ideas

### 1. SEO Foundation Bundle
**Description:** One focused PR to `index.html` and `public/`: add `<meta name="description">`, Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`), Twitter Card tags, `robots.txt` (allow `/`, `/about`; disallow `/game/*`, `/room/*`), `sitemap.xml` (home + about only), `<link rel="canonical" href="/">`, and a static JSON-LD `GameApplication` block.

**Rationale:** Every signal in this bundle is a static addition to files that already exist. No build system changes, no runtime dependencies. Googlebot, Bingbot, Slack, Discord, iMessage all read these. Right now every one of them gets a blank card with the text "jDuel".

**Downsides:** The canonical tag is a blunt instrument pointing to `/` — may need adjustment if deeper pages gain SEO value later. The JSON-LD inline `<script>` may conflict with the existing nginx CSP `script-src` policy — audit before merging.

**Confidence:** 95%
**Complexity:** Low
**Status:** Unexplored

---

### 2. Per-Route Dynamic `document.title`
**Description:** Add `useEffect` calls (or `react-helmet-async`) in `HomePage`, `GamePage`, and lobby/results components to set descriptive titles: `"jDuel — Free Online Multiplayer Trivia"` on home, `"Waiting for players — jDuel"` in lobby, `"Round in progress — jDuel"` during a game.

**Rationale:** Googlebot executes JavaScript — the rendered `<title>` is what gets indexed. "jDuel" has zero keyword value. 3-line change per route, no new dependencies required, compounds with every new route added.

**Downsides:** Crawlers that don't run JS (Bing, smaller bots) won't benefit — addressed by idea #6 (prerender).

**Confidence:** 92%
**Complexity:** Low
**Status:** Unexplored

---

### 3. Enrich AboutPage with Keyword-Rich, Player-Intent Copy
**Description:** Rewrite `AboutPage.tsx` content to target search-intent phrases (`"free online trivia game"`, `"play trivia with friends no account"`, `"real-time quiz browser game"`). Add an FAQ section covering real player questions: how many players, what topics, how rooms work, NLP-powered answer checking. Currently the only static crawlable page — mentions "Josh" and shows tech badges.

**Rationale:** The page is already structured with semantic HTML sections. Content editing, not engineering. The one URL in the app a search engine can rank for informational queries. New players found via search become hosts who generate invite links.

**Downsides:** Content quality matters — keyword stuffing hurts. Requires well-written copy. Impact is limited without prerendering (#6) or dynamic titles (#2) for full crawler coverage.

**Confidence:** 88%
**Complexity:** Low
**Status:** Unexplored

---

### 4. Branded og:image (1200×630) for Game Invite Links
**Description:** Design and commit a single evergreen `public/og-image.png` (1200×630) showing the jDuel brand and tagline — e.g., "Challenge your friends to a trivia duel." Referenced from the OG tags in idea #1. This image renders every time a `/room/AB3D` link is pasted into Discord, Slack, or iMessage.

**Rationale:** The primary discovery channel for jDuel is not Google — it's a player sharing a room link in a group chat. A rich preview image with compelling copy directly increases click-through on invites. Every game session generates 1+ share events. This compounds with the viral loop.

**Downsides:** Requires design work. A generic or ugly image is worse than a text-only card. The og:image is static — it won't show room code or live player count.

**Note on "image in Google search results":** The `image` field in JSON-LD structured data can technically influence Google search thumbnails, but Google primarily shows these for articles, recipes, and products — not web apps. The og:image matters far more for jDuel's actual distribution channel (social shares). The favicon already handles the Google search result icon.

**Confidence:** 85%
**Complexity:** Low (design effort, trivial technical integration)
**Status:** Unexplored

---

### 5. UA-Aware nginx Rule for `/room/:code` Social Previews
**Description:** Add an nginx `map` block that detects known social crawler user-agents (Slack, Discord, iMessage, Telegram, WhatsApp, Twitter/X, Facebook) and serves them a minimal static HTML response with OG tags (`"Join room AB3D on jDuel — click to play"`) instead of the SPA shell. Real browsers get the SPA as usual. No SSR server needed.

**Rationale:** `robots.txt` tells search crawlers to stay off `/room/*`, but social link-unfurlers are **not** search crawlers — they follow shared links and ignore `robots.txt`. Right now every game invite produces a blank card in every chat app. This well-established nginx pattern fixes the share experience without any React changes or edge infrastructure.

**Downsides:** Nginx UA matching needs maintenance as social apps update bot strings. Static OG response must use hardcoded copy since room state is ephemeral (no DB to query). Room code can be extracted from the URI with nginx variables for a templated response.

**Confidence:** 78%
**Complexity:** Medium (~30 lines of nginx config)
**Status:** Unexplored

---

### 6. Build-Time Prerender of `/` and `/about`
**Description:** Add a Vite post-build step (using `vite-plugin-prerender` or a lightweight Playwright snapshot) that generates static HTML snapshots of `/` and `/about` and writes them to `dist/`. Nginx serves fully-rendered HTML for those two paths. Dynamic routes remain SPA-only.

**Rationale:** Googlebot executes JS, but Bingbot, DuckDuckGo's crawler, most SEO audit tools, and the majority of smaller bots do not. Without prerendering, they all see `<div id="root"></div>`. This is the unlock that makes idea #3 (AboutPage content) indexable by the full crawler ecosystem.

**Downsides:** Adds build complexity. Playwright in a build pipeline on aarch64 Oracle VPS may need dependency management. Vite plugin options (`vite-plugin-prerender`, `vite-ssg`) need evaluation for React 19 compatibility.

**Confidence:** 72%
**Complexity:** Medium-High
**Status:** Unexplored

---

## Rejection Summary

| Idea | Reason Rejected |
|------|-----------------|
| Dynamic per-room OG image via Cloudflare Worker | Requires edge infrastructure not yet in stack; Cloudflare migration is only a brainstorm |
| Web App Manifest / PWA | Not an SEO lever; better deferred as a UX/retention improvement |
| Auto-generate SEO artifacts from Vite build script | Over-engineered for a one-time manual task; adds build complexity with no ongoing benefit |
| Auto-generate AboutPage copy from `game.py` config | Fragile coupling between marketing copy and internal config; just edit the file directly |
| Standalone CSP audit | A prerequisite step for JSON-LD, not a standalone idea; noted as caveat in idea #1 |
| Standalone canonical URL tag | Absorbed into the Foundation Bundle (#1) |

## Recommended Implementation Sequence

1. **#1 SEO Foundation Bundle** — static changes, highest coverage, no risk
2. **#2 Per-route dynamic titles** — 3 lines per route, Googlebot signal
3. **#4 Branded og:image** — design asset, multiplies viral loop
4. **#3 Enrich AboutPage** — content work, compounds with #2
5. **#5 UA-aware nginx rule** — medium effort, fixes Slack/Discord invite cards
6. **#6 Build-time prerender** — highest complexity, last

## Session Log
- 2026-04-13: Initial ideation — ~23 raw candidates generated across 3 agents, 6 survived filtering
