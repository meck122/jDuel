---
status: pending
priority: p2
issue_id: "011"
tags: [code-review, security, nginx, deployment]
dependencies: []
---

# nginx Missing Security Headers

## Problem Statement

The nginx config has no security headers beyond Cache-Control. Standard browser security protections are absent.

## Findings

- File: `deploy/nginx/jduel`
- Missing headers:
  - `X-Frame-Options: DENY` — clickjacking protection
  - `X-Content-Type-Options: nosniff` — MIME-type sniffing prevention
  - `Strict-Transport-Security` — forces HTTPS after first visit
  - `Content-Security-Policy` — restricts script sources
  - `Referrer-Policy` — prevents URL leakage to third parties
  - `Permissions-Policy` — restricts browser feature access
  - `server_tokens off` — hides nginx version from error pages

## Proposed Solution

Add to the HTTPS server block in `deploy/nginx/jduel`:
```nginx
server_tokens off;

add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' wss://jduel.com; frame-ancestors 'none';" always;
```

After adding, reload nginx and run `sudo nginx -t` first.

**Note:** Add HSTS only after confirming HTTPS is stable — it cannot be undone easily.

## Acceptance Criteria
- [ ] All 6 security headers present in nginx HTTPS server block
- [ ] `server_tokens off` set
- [ ] `sudo nginx -t` passes after changes
- [ ] No MUI or font CDN resources blocked by CSP (test in browser console)

## Work Log
- 2026-03-22: Identified by `security-sentinel` review agent
