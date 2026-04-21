"""User management routes (admin-only)."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    UserResponse,
    UserListResponse,
    UserUpdate,
    UserPasswordChange,
)
from app.services import user_service
from app.utils.dependencies import get_current_user, get_current_admin

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


@router.put(
    "/me/password",
    status_code=status.HTTP_200_OK,
    summary="Change own password",
)
async def change_my_password(
    password_data: UserPasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the current user's password."""
    success = await user_service.change_password(
        db, current_user, password_data.current_password, password_data.new_password
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    return {"message": "Password updated successfully"}


@router.get(
    "/",
    response_model=UserListResponse,
    summary="List all users (Admin)",
    dependencies=[Depends(get_current_admin)],
)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List all users with pagination. Admin access required."""
    users, total = await user_service.list_users(db, page, page_size)
    return UserListResponse(users=users, total=total, page=page, page_size=page_size)


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user by ID (Admin)",
    dependencies=[Depends(get_current_admin)],
)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific user by their ID. Admin access required."""
    user = await user_service.get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found",
        )
    return user


@router.put(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update user (Admin)",
    dependencies=[Depends(get_current_admin)],
)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a user's details. Admin access required."""
    user = await user_service.update_user(db, user_id, user_data)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found",
        )
    return user


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_200_OK,
    summary="Deactivate user (Admin)",
    dependencies=[Depends(get_current_admin)],
)
async def deactivate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a user account (soft delete). Admin access required."""
    success = await user_service.delete_user(db, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found",
        )
    return {"message": f"User {user_id} has been deactivated"}
