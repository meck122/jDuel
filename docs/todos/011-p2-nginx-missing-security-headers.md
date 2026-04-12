# TODO-011 [P2] Nginx Missing Security Headers

## Status: Pending

## Problem

The nginx config does not set standard security headers: `X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`. This leaves the app vulnerable to clickjacking, MIME sniffing, and other browser-level attacks.

## Affected Files

- `deploy/nginx/jduel` or `/etc/nginx/sites-available/jduel` — nginx server block

## Fix

Add to the nginx server block:

```nginx
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'; connect-src 'self' wss:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;" always;
```

Tune CSP based on actual resource usage (MUI may need `unsafe-inline` for styles).

## Impact

- **Severity:** Browser-level attack surface exposed
- **Fix complexity:** Low — nginx config only
