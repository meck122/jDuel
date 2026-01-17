"""Environment-specific configuration."""

import os


def _build_cors_origins(frontend_url: str) -> list[str]:
    """Build CORS origins list from frontend URL.

    Handles both localhost development and production domains.
    """
    if "localhost" in frontend_url or "127.0.0.1" in frontend_url:
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

    # Production: include both www and non-www variants
    origins = [frontend_url]
    if "://www." in frontend_url:
        origins.append(frontend_url.replace("://www.", "://"))
    else:
        origins.append(frontend_url.replace("://", "://www."))
    return origins


FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
CORS_ORIGINS = _build_cors_origins(FRONTEND_URL)
