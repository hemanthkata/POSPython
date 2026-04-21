"""Tests for reporting and analytics endpoints."""

import pytest
from httpx import AsyncClient
from datetime import date, datetime, timezone

from tests.conftest import auth_header


async def seed_sales_data(client: AsyncClient, admin_token: str, cashier_token: str):
    """Helper to create products and transactions for report testing."""
    # Create products
    p1 = await client.post(
        "/api/v1/products/",
        json={
            "name": "Widget A",
            "sku": "RPT-A01",
            "category": "other",
            "price": 25.00,
            "cost_price": 10.00,
            "stock_quantity": 200,
        },
        headers=auth_header(admin_token),
    )
    p2 = await client.post(
        "/api/v1/products/",
        json={
            "name": "Widget B",
            "sku": "RPT-B01",
            "category": "electronics",
            "price": 50.00,
            "cost_price": 20.00,
            "stock_quantity": 100,
        },
        headers=auth_header(admin_token),
    )

    pid1 = p1.json()["id"]
    pid2 = p2.json()["id"]

    # Make sales
    await client.post(
        "/api/v1/transactions/checkout",
        json={
            "items": [
                {"product_id": pid1, "quantity": 5},
                {"product_id": pid2, "quantity": 2},
            ],
            "payment_method": "cash",
        },
        headers=auth_header(cashier_token),
    )
    await client.post(
        "/api/v1/transactions/checkout",
        json={
            "items": [{"product_id": pid1, "quantity": 3}],
            "payment_method": "card",
        },
        headers=auth_header(cashier_token),
    )

    return pid1, pid2


@pytest.mark.asyncio
class TestReports:
    """Test suite for the /api/v1/reports endpoints."""

    async def test_daily_sales_report(
        self, client: AsyncClient, admin_token: str, cashier_token: str
    ):
        """Test daily sales report returns correct data."""
        await seed_sales_data(client, admin_token, cashier_token)

        today = datetime.now(timezone.utc).date().isoformat()
        response = await client.get(
            f"/api/v1/reports/sales/daily?target_date={today}",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_transactions"] == 2
        assert data["total_revenue"] > 0
        assert data["total_items_sold"] == 10  # 5 + 2 + 3

    async def test_daily_report_no_sales(self, client: AsyncClient, admin_token: str):
        """Test daily report for a day with no sales."""
        response = await client.get(
            "/api/v1/reports/sales/daily?target_date=2020-01-01",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_transactions"] == 0
        assert data["total_revenue"] == 0.0

    async def test_sales_summary_report(
        self, client: AsyncClient, admin_token: str, cashier_token: str
    ):
        """Test sales summary over a date range."""
        await seed_sales_data(client, admin_token, cashier_token)

        today = datetime.now(timezone.utc).date().isoformat()
        response = await client.get(
            f"/api/v1/reports/sales/summary?start_date={today}&end_date={today}",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_transactions"] == 2
        assert data["total_revenue"] > 0
        assert len(data["top_products"]) > 0
        assert len(data["daily_breakdown"]) == 1

    async def test_inventory_summary(
        self, client: AsyncClient, admin_token: str, cashier_token: str
    ):
        """Test inventory summary snapshot."""
        await seed_sales_data(client, admin_token, cashier_token)

        response = await client.get(
            "/api/v1/reports/inventory",
            headers=auth_header(admin_token),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_products"] >= 2
        assert data["active_products"] >= 2
        assert data["total_inventory_value"] > 0

    async def test_sales_report_cashier_forbidden(
        self, client: AsyncClient, cashier_token: str
    ):
        """Test cashier cannot access sales reports."""
        today = datetime.now(timezone.utc).date().isoformat()
        response = await client.get(
            f"/api/v1/reports/sales/daily?target_date={today}",
            headers=auth_header(cashier_token),
        )
        assert response.status_code == 403

    async def test_inventory_report_cashier_allowed(
        self, client: AsyncClient, cashier_token: str
    ):
        """Test cashier can access inventory summary."""
        response = await client.get(
            "/api/v1/reports/inventory",
            headers=auth_header(cashier_token),
        )
        assert response.status_code == 200
