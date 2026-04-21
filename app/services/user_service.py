"""User management service: CRUD operations."""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.utils.security import hash_password, verify_password


async def create_user(db: AsyncSession, user_data: UserCreate) -> User:
    """Create a new user account.

    Raises:
        ValueError: If username or email already exists.
    """
    # Check for existing username
    existing = await db.execute(select(User).where(User.username == user_data.username))
    if existing.scalar_one_or_none():
        raise ValueError(f"Username '{user_data.username}' already exists")

    # Check for existing email
    existing = await db.execute(select(User).where(User.email == user_data.email))
    if existing.scalar_one_or_none():
        raise ValueError(f"Email '{user_data.email}' already registered")

    user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    """Retrieve a user by their ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    """Retrieve a user by their username."""
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def list_users(
    db: AsyncSession, page: int = 1, page_size: int = 20
) -> tuple[list[User], int]:
    """List users with pagination.

    Returns:
        Tuple of (list of users, total count).
    """
    offset = (page - 1) * page_size

    # Get total count
    count_result = await db.execute(select(func.count(User.id)))
    total = count_result.scalar()

    # Get paginated results
    result = await db.execute(
        select(User).order_by(User.created_at.desc()).offset(offset).limit(page_size)
    )
    users = list(result.scalars().all())

    return users, total


async def update_user(db: AsyncSession, user_id: int, user_data: UserUpdate) -> User | None:
    """Update an existing user's details.

    Returns:
        Updated User object, or None if user not found.
    """
    user = await get_user_by_id(db, user_id)
    if user is None:
        return None

    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)
    return user


async def change_password(
    db: AsyncSession, user: User, current_password: str, new_password: str
) -> bool:
    """Change a user's password after verifying the current one.

    Returns:
        True if password was changed, False if current password is incorrect.
    """
    if not verify_password(current_password, user.hashed_password):
        return False

    user.hashed_password = hash_password(new_password)
    await db.flush()
    return True


async def delete_user(db: AsyncSession, user_id: int) -> bool:
    """Soft-delete a user by deactivating their account.

    Returns:
        True if user was deactivated, False if user not found.
    """
    user = await get_user_by_id(db, user_id)
    if user is None:
        return False

    user.is_active = False
    await db.flush()
    return True
