# TODO-024 [P3] Homepage Inaccessible Clickable Divs

## Status: Pending

## Problem

Home page cards use `<div onClick>` instead of semantic `<button>` or `<a>` elements. These are not keyboard-focusable or screen-reader accessible — users can't tab to them or activate them with Enter/Space.

## Affected Files

- `frontend/src/pages/HomePage/HomePage.tsx:111-133` — Host card: `<div onClick={() => setActiveCard("host")}>`
- `frontend/src/pages/HomePage/HomePage.tsx:136-166` — Join card: `<div onClick={() => setActiveCard("join")}>`
- `frontend/src/pages/HomePage/HomePage.module.css:72` — `cursor: pointer` confirms interactive intent

## Fix

Replace `<div onClick={handler}>` with `<button onClick={handler}>` (or MUI `<ButtonBase>`/`<Card>` with `component="button"`). Style as needed to preserve visual appearance.

If keeping `<div>`, at minimum add:
```tsx
<div onClick={handler} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handler()}>
```

But semantic HTML (`<button>`) is strongly preferred.

## Impact

- **Severity:** Accessibility violation (WCAG 2.1 Level A)
- **Fix complexity:** Low
