# TODO-005 [P1] Rate Limiter IP Spoofing via X-Forwarded-For

## Status: Pending

## Problem

The rate limiter extracts client IP from `X-Forwarded-For` header, which any client can set to an arbitrary value. This completely bypasses all rate limits (room creation, room joining, WS messages).

## Affected Files

- `backend/src/app/api/dependencies.py:28-43` — `get_client_ip()` trusts raw `X-Forwarded-For` header:
  ```python
  forwarded = request.headers.get("X-Forwarded-For")
  if forwarded:
      return forwarded.split(",")[0].strip()  # client-controlled!
  ```

## Fix

Since nginx is the only reverse proxy in production:

1. **Configure nginx** to set `X-Forwarded-For` to `$remote_addr` (overwrite, don't append)
2. **In the backend**, use `request.client.host` as the trusted source when behind a single proxy, or use Starlette's `TrustedHostMiddleware`/`ProxyHeadersMiddleware` with `trusted_hosts` set to only the nginx IP:

```python
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
app = FastAPI()
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["127.0.0.1"])
```

3. **Never trust raw X-Forwarded-For** from the client

## Impact

- **Severity:** All rate limits are completely bypassable
- **Fix complexity:** Low — middleware config change
- **Risk:** Low — standard practice

## Testing

- Test rate limiting with spoofed X-Forwarded-For headers
- Verify limits still apply
