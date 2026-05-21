"""Tests for authentication endpoints."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_header


class TestAuthentication:
    """Test suite for the /api/v1/auth endpoints."""

    async def test_register_user(self, client: AsyncClient):
        """Test successful user registration."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "username": "newuser",
                "email": "newuser@test.com",
                "password": "password123",
                "full_name": "New User",
                "role": "cashier",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "newuser"
        assert data["email"] == "newuser@test.com"
        assert data["role"] == "cashier"

    async def test_register_duplicate_username(self, client: AsyncClient, admin_user):
        """Test registration fails with duplicate username."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "username": "testadmin",
                "email": "other@test.com",
                "password": "password123",
                "full_name": "Duplicate",
            },
        )
        assert response.status_code == 409

    async def test_login_success(self, client: AsyncClient, admin_user):
        """Test successful login returns tokens."""
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": "testadmin", "password": "admin123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client: AsyncClient, admin_user):
        """Test login fails with wrong password."""
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": "testadmin", "password": "wrongpass"},
        )
        assert response.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient):
        """Test login fails for non-existent user."""
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": "ghost", "password": "password123"},
        )
        assert response.status_code == 401

    async def test_token_refresh(self, client: AsyncClient, admin_user):
        """Test token refresh returns new tokens."""
        # First login to get refresh token
        login_resp = await client.post(
            "/api/v1/auth/login",
            data={"username": "testadmin", "password": "admin123"},
        )
        refresh_token = login_resp.json()["refresh_token"]

        # Use refresh token
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert response.status_code == 200
        assert "access_token" in response.json()

    async def test_invalid_refresh_token(self, client: AsyncClient):
        """Test refresh fails with invalid token."""
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid.token.here"},
        )
        assert response.status_code == 401

    async def test_get_current_user(self, client: AsyncClient, admin_token: str):
        """Test getting current user profile."""
        response = await client.get(
            "/api/v1/users/me",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        assert response.json()["username"] == "testadmin"

    async def test_unauthorized_access(self, client: AsyncClient):
        """Test accessing protected endpoint without token."""
        response = await client.get("/api/v1/users/me")
        assert response.status_code == 401
