---
date: 2026-04-13
topic: png-favicon
---

# PNG Favicon for Google Search

## Problem Frame

jDuel's `index.html` only references `favicon.svg`. Google's search crawler prefers raster images (PNG) over SVG for the icon shown next to URLs in search results — an SVG-only setup is the most common reason the icon doesn't appear in search.

## Requirements

- R1. Generate `frontend/public/favicon-192.png` (192×192) from the existing `favicon.svg` — the minimum size Google accepts is 48×48; 192 hits the recommended multiple of 48.
- R2. Generate `frontend/public/apple-touch-icon.png` (180×180) for iOS home screen bookmarks.
- R3. Add `<link>` tags to `frontend/index.html` for both PNG assets, placed **after** the existing SVG `<link>` so SVG remains the preferred format for browsers that support it.

## Success Criteria

- After deploying, Google Search Console (or a crawl) picks up a favicon for `jduel.com`.
- The favicon appears next to the URL in Google search results within Google's normal re-index window.
- The icon appears correctly on iOS when saving to the home screen.

## Scope Boundaries

- No `favicon.ico` — ICO adds complexity with negligible benefit given Google's current PNG support.
- No PWA `manifest.json` changes — out of scope for this PR.
- No design changes to the favicon — use the existing `favicon.svg` as the source.
- No new npm dependencies.

## Key Decisions

- **192px over 512px:** Sufficient for Google and avoids large file size; the SVG handles anything needing infinite resolution.
- **PNG alongside SVG, not replacing it:** SVG is the better format for modern browsers and stays as the primary icon.

## Dependencies / Assumptions

- `frontend/public/favicon.svg` exists and is the canonical design source.
- PNG generation tooling (Playwright MCP, Inkscape, or rsvg-convert) is available in the dev environment.

## Next Steps
→ `/ce:plan` for structured implementation planning
