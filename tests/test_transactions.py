"""Tests for transaction/checkout endpoints."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_header


async def create_test_product(client: AsyncClient, admin_token: str, sku_suffix: str = "001"):
    """Helper to create a product for transaction tests."""
    response = await client.post(
        "/api/v1/products/",
        json={
            "name": f"Test Item {sku_suffix}",
            "sku": f"TST-{sku_suffix}",
            "category": "other",
            "price": 10.00,
            "cost_price": 5.00,
            "stock_quantity": 50,
        },
        headers=auth_header(admin_token),
    )
    return response.json()["id"]


@pytest.mark.asyncio
class TestTransactions:
    """Test suite for the /api/v1/transactions endpoints."""

    async def test_checkout_single_item(
        self, client: AsyncClient, admin_token: str, cashier_token: str
    ):
        """Test basic checkout with a single item."""
        product_id = await create_test_product(client, admin_token)

        response = await client.post(
            "/api/v1/transactions/checkout",
            json={
                "items": [{"product_id": product_id, "quantity": 2}],
                "payment_method": "cash",
            },
            headers=auth_header(cashier_token),
        )
        assert response.status_code == 201
        data = response.json()
        assert data["subtotal"] == 20.00  # 10 * 2
        assert data["transaction_id"] is not None
        assert data["status"] == "completed"
        assert len(data["items"]) == 1

    async def test_checkout_multiple_items(
        self, client: AsyncClient, admin_token: str, cashier_token: str
    ):
        """Test checkout with multiple different items."""
        pid1 = await create_test_product(client, admin_token, "A01")
        pid2 = await create_test_product(client, admin_token, "A02")

        response = await client.post(
            "/api/v1/transactions/checkout",
            json={
                "items": [
                    {"product_id": pid1, "quantity": 3},
                    {"product_id": pid2, "quantity": 1},
                ],
                "payment_method": "card",
            },
            headers=auth_header(cashier_token),
        )
        assert response.status_code == 201
        data = response.json()
        assert data["subtotal"] == 40.00  # (10*3) + (10*1)
        assert len(data["items"]) == 2

    async def test_checkout_with_discount(
        self, client: AsyncClient, admin_token: str, cashier_token: str
    ):
        """Test checkout applies discount correctly."""
        product_id = await create_test_product(client, admin_token, "D01")

        response = await client.post(
            "/api/v1/transactions/checkout",
            json={
                "items": [{"product_id": product_id, "quantity": 10}],
                "payment_method": "cash",
                "discount_percent": 10.0,
            },
            headers=auth_header(cashier_token),
        )
        assert response.status_code == 201
        data = response.json()
        assert data["subtotal"] == 100.00
        assert data["discount_amount"] == 10.00  # 10% of 100

    async def test_checkout_deducts_stock(
        self, client: AsyncClient, admin_token: str, cashier_token: str
    ):
        """Test that checkout correctly deducts stock."""
        product_id = await create_test_product(client, admin_token, "S01")

        # Checkout 5 units
        await client.post(
            "/api/v1/transactions/checkout",
            json={
                "items": [{"product_id": product_id, "quantity": 5}],
                "payment_method": "cash",
            },
            headers=auth_header(cashier_token),
        )

        # Check stock was deducted
        response = await client.get(
            f"/api/v1/products/{product_id}",
            headers=auth_header(admin_token),
        )
        assert response.json()["stock_quantity"] == 45  # 50 - 5

    async def test_checkout_insufficient_stock(
        self, client: AsyncClient, admin_token: str, cashier_token: str
    ):
        """Test checkout fails when stock is insufficient."""
        product_id = await create_test_product(client, admin_token, "IS01")

        response = await client.post(
            "/api/v1/transactions/checkout",
            json={
                "items": [{"product_id": product_id, "quantity": 999}],
                "payment_method": "cash",
            },
            headers=auth_header(cashier_token),
        )
        assert response.status_code == 400

    async def test_checkout_nonexistent_product(
        self, client: AsyncClient, cashier_token: str
    ):
        """Test checkout fails with non-existent product ID."""
        response = await client.post(
            "/api/v1/transactions/checkout",
            json={
                "items": [{"product_id": 99999, "quantity": 1}],
                "payment_method": "cash",
            },
            headers=auth_header(cashier_token),
        )
        assert response.status_code == 400

    async def test_list_transactions(
        self, client: AsyncClient, admin_token: str, cashier_token: str
    ):
        """Test listing transactions."""
        product_id = await create_test_product(client, admin_token, "L01")

        # Make a sale
        await client.post(
            "/api/v1/transactions/checkout",
            json={
                "items": [{"product_id": product_id, "quantity": 1}],
                "payment_method": "cash",
            },
            headers=auth_header(cashier_token),
        )

        response = await client.get(
            "/api/v1/transactions/",
            headers=auth_header(cashier_token),
        )
        assert response.status_code == 200
        assert response.json()["total"] >= 1

    async def test_get_transaction_detail(
        self, client: AsyncClient, admin_token: str, cashier_token: str
    ):
        """Test getting a specific transaction by UUID."""
        product_id = await create_test_product(client, admin_token, "G01")

        checkout_resp = await client.post(
            "/api/v1/transactions/checkout",
            json={
                "items": [{"product_id": product_id, "quantity": 1}],
                "payment_method": "cash",
            },
            headers=auth_header(cashier_token),
        )
        tx_id = checkout_resp.json()["transaction_id"]

        response = await client.get(
            f"/api/v1/transactions/{tx_id}",
            headers=auth_header(cashier_token),
        )
        assert response.status_code == 200
        assert response.json()["transaction_id"] == tx_id

    async def test_refund_transaction(
        self, client: AsyncClient, admin_token: str, cashier_token: str
    ):
        """Test refunding a transaction restores stock."""
        product_id = await create_test_product(client, admin_token, "R01")

        # Checkout
        checkout_resp = await client.post(
            "/api/v1/transactions/checkout",
            json={
                "items": [{"product_id": product_id, "quantity": 10}],
                "payment_method": "cash",
            },
            headers=auth_header(cashier_token),
        )
        tx_id = checkout_resp.json()["transaction_id"]

        # Refund (admin only)
        response = await client.post(
            f"/api/v1/transactions/{tx_id}/refund",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        assert response.json()["status"] == "refunded"

        # Verify stock restored
        prod_resp = await client.get(
            f"/api/v1/products/{product_id}",
            headers=auth_header(admin_token),
        )
        assert prod_resp.json()["stock_quantity"] == 50  # Restored

    async def test_refund_by_cashier_forbidden(
        self, client: AsyncClient, admin_token: str, cashier_token: str
    ):
        """Test that cashiers cannot refund transactions."""
        product_id = await create_test_product(client, admin_token, "RF01")

        checkout_resp = await client.post(
            "/api/v1/transactions/checkout",
            json={
                "items": [{"product_id": product_id, "quantity": 1}],
                "payment_method": "cash",
            },
            headers=auth_header(cashier_token),
        )
        tx_id = checkout_resp.json()["transaction_id"]

        response = await client.post(
            f"/api/v1/transactions/{tx_id}/refund",
            headers=auth_header(cashier_token),
        )
        assert response.status_code == 403
