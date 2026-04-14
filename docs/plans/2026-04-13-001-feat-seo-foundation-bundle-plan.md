---
title: "feat: Add SEO Foundation Bundle"
type: feat
status: active
date: 2026-04-13
origin: docs/brainstorms/2026-04-13-seo-foundation-bundle-requirements.md
---

# feat: Add SEO Foundation Bundle

## Overview

Three static file changes that deliver the full SEO baseline for jDuel in a single PR:

1. **`frontend/index.html`** — meta description, Open Graph, Twitter Card, canonical URL, JSON-LD structured data
2. **`frontend/public/robots.txt`** — crawler guidance (allow `/`, `/about`; disallow `/game/`, `/room/`)
3. **`frontend/public/sitemap.xml`** — index of the two permanent crawlable routes

The branded og:image (`frontend/public/og-image.png`, 1200×630) was created separately and is ready to reference.

## Problem Statement

Every search engine, social link unfurler (Slack, Discord, iMessage), and SEO tool currently sees a blank page titled "jDuel" with nothing else. Room invite links — the primary viral distribution channel — produce blank preview cards in group chats. All of this is fixable with static file additions, no build system changes needed.

## Technical Considerations

**JSON-LD and the existing CSP**
The nginx config at `deploy/nginx/jduel` sets `script-src 'self'`. A `<script type="application/ld+json">` tag is **not** subject to `script-src` — it has a data MIME type, not an executable JavaScript MIME type. No CSP change is required.
_(See origin: docs/brainstorms/2026-04-13-seo-foundation-bundle-requirements.md — Key Decisions)_

**og:image is now available**
`frontend/public/og-image.png` (1200×630, PNG) exists and should be included in the OG and Twitter card tags. The requirements doc originally deferred this; include it now.

**Canonical covers www/non-www split**
Both `jduel.com` and `www.jduel.com` are served by nginx. The canonical tag pointing to `https://jduel.com/` consolidates crawl equity and prevents duplicate indexing of ephemeral routes.
_(See origin: docs/brainstorms/2026-04-13-seo-foundation-bundle-requirements.md — Key Decisions)_

**Vite copies `public/` verbatim**
Files in `frontend/public/` are copied unchanged to `dist/` by Vite. `robots.txt` and `sitemap.xml` will be available at the root path in production without any build config changes.

## Acceptance Criteria

- [ ] `curl https://jduel.com` returns a page with a `<meta name="description">` tag
- [ ] Pasting `https://jduel.com` into Slack/Discord renders a card with title, description, and og:image
- [ ] `curl https://jduel.com/robots.txt` returns a file that disallows `/game/` and `/room/`
- [ ] `curl https://jduel.com/sitemap.xml` returns a valid XML sitemap with `/` and `/about` entries
- [ ] Google's Rich Results Test parses the JSON-LD block without errors
- [ ] No new CSP violations appear in the browser console after the change

## Implementation

### 1. `frontend/index.html` — head additions

Insert the following inside `<head>`, after the existing `<title>` tag:

```html
<!-- SEO -->
<meta name="description" content="Free real-time multiplayer trivia game. Challenge your friends to a trivia duel — no account required." />
<link rel="canonical" href="https://jduel.com/" />

<!-- Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:url" content="https://jduel.com/" />
<meta property="og:title" content="jDuel — Real-Time Multiplayer Trivia" />
<meta property="og:description" content="Challenge your friends to a trivia duel. Free, real-time, no account required." />
<meta property="og:image" content="https://jduel.com/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="jDuel — Real-Time Multiplayer Trivia" />
<meta name="twitter:description" content="Challenge your friends to a trivia duel. Free, real-time, no account required." />
<meta name="twitter:image" content="https://jduel.com/og-image.png" />

<!-- Structured Data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "jDuel",
  "description": "Free real-time multiplayer trivia game. Challenge your friends to a trivia duel.",
  "url": "https://jduel.com",
  "applicationCategory": "GameApplication",
  "genre": "Trivia",
  "operatingSystem": "Web Browser",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
}
</script>
```

### 2. `frontend/public/robots.txt` — new file

```
User-agent: *
Allow: /
Allow: /about
Disallow: /game/
Disallow: /room/

Sitemap: https://jduel.com/sitemap.xml
```

### 3. `frontend/public/sitemap.xml` — new file

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://jduel.com/</loc>
    <lastmod>2026-04-13</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://jduel.com/about</loc>
    <lastmod>2026-04-13</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

## Verification Steps

After deploying:

1. **Social preview:** Paste `https://jduel.com` into [opengraph.xyz](https://www.opengraph.xyz) or Discord to confirm the card renders with image, title, and description.
2. **Structured data:** Run `https://jduel.com` through [Google's Rich Results Test](https://search.google.com/test/rich-results) to confirm JSON-LD parses without errors.
3. **Robots:** `curl https://jduel.com/robots.txt` — confirm `Disallow: /game/` and `Disallow: /room/` are present.
4. **CSP:** Open browser DevTools console on production, hard refresh — confirm no new CSP violation errors.

## Deferred (out of scope)

- Per-route dynamic `document.title` (ideation idea #2)
- AboutPage keyword-rich content rewrite (ideation idea #3)
- UA-aware nginx rule for `/room/:code` social previews (ideation idea #5)
- Build-time prerendering (ideation idea #6)

## Sources

- **Origin document:** [docs/brainstorms/2026-04-13-seo-foundation-bundle-requirements.md](../brainstorms/2026-04-13-seo-foundation-bundle-requirements.md)
  Key decisions carried forward: skip og:image (now reversed — image created), canonical → `https://jduel.com/`, JSON-LD safe under existing CSP
- `frontend/index.html` — target file (14 lines, empty head)
- `deploy/nginx/jduel:17` — CSP header (`script-src 'self'`)
- `frontend/public/og-image.png` — og:image asset (1200×630, just created)
