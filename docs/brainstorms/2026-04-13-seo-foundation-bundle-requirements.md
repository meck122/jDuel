---
date: 2026-04-13
topic: seo-foundation-bundle
---

# SEO Foundation Bundle

## Problem Frame

jDuel's `index.html` has no meta description, no Open Graph tags, no structured data, and no crawler guidance. Every search engine, social link unfurler (Slack, Discord, iMessage), and SEO tool sees a blank page titled "jDuel" with nothing else. This is a collection of static, low-risk changes that together deliver the full baseline SEO signal — addressable in a single PR.

## Requirements

- **R1.** Add `<meta name="description">` to `index.html` with a concise, keyword-relevant description of jDuel (e.g., "Free real-time multiplayer trivia game — play with friends, no account required").
- **R2.** Add Open Graph tags to `index.html`: `og:title`, `og:description`, `og:type` (`website`), and `og:url` (`https://jduel.com`). Omit `og:image` — deferred to the branded image work (idea #4).
- **R3.** Add Twitter Card tags to `index.html`: `twitter:card` (`summary`), `twitter:title`, `twitter:description`. Omit `twitter:image` for the same reason as R2.
- **R4.** Add `<link rel="canonical" href="https://jduel.com/">` to `index.html` to prevent duplicate content signals from ephemeral routes (`/room/:code`, `/game/:roomId`) being indexed.
- **R5.** Add a JSON-LD `WebApplication` structured data block to `index.html` describing jDuel as a free, browser-based game (`applicationCategory: "GameApplication"`, `price: "0"`, `operatingSystem: "Web Browser"`). This uses `<script type="application/ld+json">` which is not subject to the existing `script-src 'self'` CSP (non-executable MIME type).
- **R6.** Add `frontend/public/robots.txt` allowing crawlers on `/` and `/about`, and disallowing `/game/` and `/room/` (ephemeral game session routes with no indexable content).
- **R7.** Add `frontend/public/sitemap.xml` listing `/` and `/about` with `https://jduel.com` as the base URL and a static `lastmod` date.

## Success Criteria

- Pasting `https://jduel.com` into Slack/Discord renders a text card with a title and description (no image yet).
- Google Search Console (when connected) shows no "missing meta description" warnings for the home route.
- `curl https://jduel.com/robots.txt` returns a valid file disallowing `/game/` and `/room/`.
- A structured data validation tool (e.g., Google's Rich Results Test) parses the JSON-LD block without errors.

## Scope Boundaries

- **No og:image / twitter:image** — deferred to the branded image design (ideation idea #4).
- **No per-route dynamic titles** — deferred (ideation idea #2); this bundle only changes the static HTML shell.
- **No AboutPage content changes** — deferred (ideation idea #3).
- **No build-time prerendering** — deferred (ideation idea #6).
- **No UA-aware nginx rules** — deferred (ideation idea #5).
- **No changes to the nginx CSP** — the existing `script-src 'self'` policy does not block `<script type="application/ld+json">`.

## Key Decisions

- **Skip og:image for now:** No suitable raster image exists. `favicon.svg` is not a valid og:image (wrong format and dimensions). A missing tag produces the current behavior (text-only card); a bad placeholder is worse.
- **Canonical points to `https://jduel.com/`:** Covers the www/non-www split (both are served) and prevents duplicate indexing of ephemeral routes.
- **robots.txt disallows `/game/` and `/room/`:** These routes require live WebSocket state and will always render an empty shell to crawlers. Disallowing saves crawl budget and prevents soft-404 signals.
- **JSON-LD is safe under the current CSP:** `script-src` only governs executable JavaScript MIME types. `application/ld+json` is a data type, not executable — no CSP change needed.

## Dependencies / Assumptions

- Production domain is `https://jduel.com` (canonical, non-www preferred).
- `/about` route (`AboutPage.tsx`) exists and is a stable, non-ephemeral page worth indexing.
- `frontend/public/` files are copied to `dist/` by Vite and served at the root by nginx.

## Outstanding Questions

### Deferred to Planning
- [Affects R5][Needs research] Confirm that Google's Rich Results Test accepts the JSON-LD block without CSP interference in the production nginx environment.
- [Affects R7][Technical] Confirm `changefreq` and `priority` values for sitemap entries — standard defaults (`weekly` / `1.0` for home, `monthly` / `0.8` for about) are likely sufficient.

## Next Steps
→ `/ce:plan` for structured implementation planning
