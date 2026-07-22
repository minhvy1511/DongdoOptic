import os

from fastapi import Header, HTTPException, status


ADMIN_API_KEY_ENV = "DONGDO_ADMIN_API_KEY"


def require_admin_api_key(x_admin_key: str | None = Header(default=None)) -> None:
    expected_key = os.environ.get(ADMIN_API_KEY_ENV, "").strip()
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin API is disabled until DONGDO_ADMIN_API_KEY is configured.",
        )

    if not x_admin_key or x_admin_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin API key is required.",
        )
