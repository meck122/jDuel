---
title: "feat: Add PNG favicon for Google Search and iOS"
type: feat
status: active
date: 2026-04-13
origin: docs/brainstorms/2026-04-13-png-favicon-requirements.md
---

# feat: Add PNG favicon for Google Search and iOS

## Overview

jDuel's `index.html` only references `favicon.svg`. Google's search crawler prefers raster PNG over SVG — an SVG-only setup is the most common reason the favicon doesn't appear in search results. This PR generates two PNG assets from the existing `favicon.svg` using ImageMagick and adds the corresponding `<link>` tags to `index.html`.
_(See origin: docs/brainstorms/2026-04-13-png-favicon-requirements.md)_

## Acceptance Criteria

- [ ] `frontend/public/favicon-192.png` exists at 192×192px
- [ ] `frontend/public/apple-touch-icon.png` exists at 180×180px
- [ ] `index.html` includes a `<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">` tag
- [ ] `index.html` includes a `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` tag
- [ ] Both PNG tags appear **after** the existing SVG `<link>` so SVG remains preferred in browsers that support it
- [ ] No new npm dependencies introduced
- [ ] `npm run build` passes without errors

## Implementation

### Step 1 — Generate PNG assets

Run from the repo root using ImageMagick (`convert`, available at `/usr/bin/convert`):

```bash
convert -background none -resize 192x192 \
  frontend/public/favicon.svg \
  frontend/public/favicon-192.png

convert -background none -resize 180x180 \
  frontend/public/favicon.svg \
  frontend/public/apple-touch-icon.png
```

Verify the output files exist and are non-zero:
```bash
ls -lh frontend/public/favicon-192.png frontend/public/apple-touch-icon.png
```

### Step 2 — Update `frontend/index.html`

Insert after the existing SVG icon link (line 5):

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

The SVG `<link>` stays first — modern browsers prefer it. The PNG `<link>` is the fallback Google's crawler and older browsers will use.

## Context

- `frontend/public/favicon.svg` — source file, 32×32 viewBox, two gradient lightning bolt polygons on a `#12101c` background
- Google's favicon requirements: minimum 48×48, must be a multiple of 48px — 192 satisfies this (4×48)
- Apple touch icon: iOS uses this when saving to the home screen; 180×180 is the recommended size for modern iPhones
- `frontend/public/` files are copied verbatim to `dist/` by Vite — no build config changes needed
- The SVG-only gap is the most common reason favicons don't appear in Google search results (see origin brainstorm)

## Sources

- **Origin document:** [docs/brainstorms/2026-04-13-png-favicon-requirements.md](../brainstorms/2026-04-13-png-favicon-requirements.md) — Key decisions: 192px PNG + 180px apple-touch-icon; SVG stays primary; no favicon.ico; no new dependencies
- `frontend/index.html:5` — existing SVG icon link (insertion point)
- `frontend/public/favicon.svg` — source asset
