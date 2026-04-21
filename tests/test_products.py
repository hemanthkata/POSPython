"""Tests for product/inventory endpoints."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_header


SAMPLE_PRODUCT = {
    "name": "Test Coffee",
    "sku": "BEV-COF-001",
    "description": "Premium test coffee",
    "category": "beverage",
    "price": 5.99,
    "cost_price": 2.50,
    "stock_quantity": 100,
    "low_stock_threshold": 10,
}


@pytest.mark.asyncio
class TestProducts:
    """Test suite for the /api/v1/products endpoints."""

    async def test_create_product_as_admin(self, client: AsyncClient, admin_token: str):
        """Test admin can create a product."""
        response = await client.post(
            "/api/v1/products/",
            json=SAMPLE_PRODUCT,
            headers=auth_header(admin_token),
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Coffee"
        assert data["sku"] == "BEV-COF-001"
        assert data["stock_quantity"] == 100
        assert data["is_low_stock"] is False
        assert data["is_out_of_stock"] is False

    async def test_create_product_as_cashier_forbidden(
        self, client: AsyncClient, cashier_token: str
    ):
        """Test cashier cannot create products."""
        response = await client.post(
            "/api/v1/products/",
            json=SAMPLE_PRODUCT,
            headers=auth_header(cashier_token),
        )
        assert response.status_code == 403

    async def test_create_duplicate_sku(self, client: AsyncClient, admin_token: str):
        """Test creating product with duplicate SKU fails."""
        await client.post(
            "/api/v1/products/",
            json=SAMPLE_PRODUCT,
            headers=auth_header(admin_token),
        )
        response = await client.post(
            "/api/v1/products/",
            json=SAMPLE_PRODUCT,
            headers=auth_header(admin_token),
        )
        assert response.status_code == 409

    async def test_list_products(self, client: AsyncClient, admin_token: str):
        """Test listing products with pagination."""
        # Create a product first
        await client.post(
            "/api/v1/products/",
            json=SAMPLE_PRODUCT,
            headers=auth_header(admin_token),
        )

        response = await client.get(
            "/api/v1/products/",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert len(data["products"]) >= 1

    async def test_list_products_with_search(self, client: AsyncClient, admin_token: str):
        """Test searching products by name."""
        await client.post(
            "/api/v1/products/",
            json=SAMPLE_PRODUCT,
            headers=auth_header(admin_token),
        )

        response = await client.get(
            "/api/v1/products/?search=Coffee",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        assert response.json()["total"] >= 1

    async def test_list_products_with_category_filter(
        self, client: AsyncClient, admin_token: str
    ):
        """Test filtering products by category."""
        await client.post(
            "/api/v1/products/",
            json=SAMPLE_PRODUCT,
            headers=auth_header(admin_token),
        )

        response = await client.get(
            "/api/v1/products/?category=beverage",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        assert response.json()["total"] >= 1

    async def test_get_product_by_id(self, client: AsyncClient, admin_token: str):
        """Test getting a single product by ID."""
        create_resp = await client.post(
            "/api/v1/products/",
            json=SAMPLE_PRODUCT,
            headers=auth_header(admin_token),
        )
        product_id = create_resp.json()["id"]

        response = await client.get(
            f"/api/v1/products/{product_id}",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        assert response.json()["id"] == product_id

    async def test_get_nonexistent_product(self, client: AsyncClient, admin_token: str):
        """Test getting a non-existent product returns 404."""
        response = await client.get(
            "/api/v1/products/99999",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 404

    async def test_update_product(self, client: AsyncClient, admin_token: str):
        """Test updating a product."""
        create_resp = await client.post(
            "/api/v1/products/",
            json=SAMPLE_PRODUCT,
            headers=auth_header(admin_token),
        )
        product_id = create_resp.json()["id"]

        response = await client.put(
            f"/api/v1/products/{product_id}",
            json={"name": "Updated Coffee", "price": 7.99},
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Coffee"
        assert response.json()["price"] == 7.99

    async def test_adjust_stock(self, client: AsyncClient, admin_token: str):
        """Test adjusting product stock."""
        create_resp = await client.post(
            "/api/v1/products/",
            json=SAMPLE_PRODUCT,
            headers=auth_header(admin_token),
        )
        product_id = create_resp.json()["id"]

        response = await client.patch(
            f"/api/v1/products/{product_id}/stock",
            json={"quantity": 50, "reason": "Restock"},
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        assert response.json()["stock_quantity"] == 150  # 100 + 50

    async def test_adjust_stock_insufficient(self, client: AsyncClient, admin_token: str):
        """Test stock deduction fails with insufficient stock."""
        create_resp = await client.post(
            "/api/v1/products/",
            json=SAMPLE_PRODUCT,
            headers=auth_header(admin_token),
        )
        product_id = create_resp.json()["id"]

        response = await client.patch(
            f"/api/v1/products/{product_id}/stock",
            json={"quantity": -200, "reason": "Deduction"},
            headers=auth_header(admin_token),
        )
        assert response.status_code == 400

    async def test_deactivate_product(self, client: AsyncClient, admin_token: str):
        """Test deactivating (soft-deleting) a product."""
        create_resp = await client.post(
            "/api/v1/products/",
            json=SAMPLE_PRODUCT,
            headers=auth_header(admin_token),
        )
        product_id = create_resp.json()["id"]

        response = await client.delete(
            f"/api/v1/products/{product_id}",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
