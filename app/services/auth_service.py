"""Authentication service: login, token generation, and refresh."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.utils.security import verify_password, create_access_token, create_refresh_token, decode_token


async def authenticate_user(db: AsyncSession, username: str, password: str) -> User | None:
    """Authenticate a user by username and password.

    Returns:
        The User object if credentials are valid, None otherwise.
    """
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if user is None:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None

    return user


def generate_tokens(user: User) -> dict:
    """Generate access and refresh token pair for a user.

    Returns:
        Dict with access_token, refresh_token, and token_type.
    """
    token_data = {"sub": user.username, "role": user.role.value}
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type": "bearer",
    }


async def refresh_access_token(db: AsyncSession, refresh_token: str) -> dict | None:
    """Validate a refresh token and issue a new access token pair.

    Returns:
        New token pair dict, or None if the refresh token is invalid.
    """
    payload = decode_token(refresh_token)
    if payload is None or payload.get("type") != "refresh":
        return None

    username = payload.get("sub")
    if username is None:
        return None

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        return None

    return generate_tokens(user)
