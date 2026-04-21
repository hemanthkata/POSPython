"""Pydantic schemas for user management and authentication."""

from datetime import datetime
from pydantic import BaseModel, Field, EmailStr

from app.models.user import UserRole


# ── Auth Schemas ──────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    """JWT token pair response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefreshRequest(BaseModel):
    """Refresh token request body."""
    refresh_token: str


# ── User Schemas ──────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    """Schema for creating a new user."""
    username: str = Field(..., min_length=3, max_length=50, examples=["john_doe"])
    email: EmailStr = Field(..., examples=["john@example.com"])
    password: str = Field(..., min_length=6, max_length=128, examples=["securepass123"])
    full_name: str = Field(..., min_length=1, max_length=100, examples=["John Doe"])
    role: UserRole = Field(default=UserRole.CASHIER, examples=[UserRole.CASHIER])


class UserUpdate(BaseModel):
    """Schema for updating an existing user. All fields optional."""
    email: EmailStr | None = None
    full_name: str | None = Field(None, min_length=1, max_length=100)
    role: UserRole | None = None
    is_active: bool | None = None


class UserPasswordChange(BaseModel):
    """Schema for changing user password."""
    current_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=6, max_length=128)


class UserResponse(BaseModel):
    """Schema for user data returned in API responses."""
    id: int
    username: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    """Paginated list of users."""
    users: list[UserResponse]
    total: int
    page: int
    page_size: int
