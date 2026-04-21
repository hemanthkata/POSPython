"""Pydantic schemas for reporting and analytics."""

from datetime import date
from pydantic import BaseModel


class DailySalesReport(BaseModel):
    """Revenue and transaction summary for a single day."""
    date: date
    total_revenue: float
    total_transactions: int
    total_items_sold: int
    average_transaction_value: float


class TopSellingProduct(BaseModel):
    """Product ranked by sales volume."""
    product_id: int
    product_name: str
    total_quantity_sold: int
    total_revenue: float


class SalesSummaryReport(BaseModel):
    """Aggregate sales summary over a date range."""
    start_date: date
    end_date: date
    total_revenue: float
    total_transactions: int
    total_items_sold: int
    average_daily_revenue: float
    top_products: list[TopSellingProduct]
    daily_breakdown: list[DailySalesReport]


class InventorySummary(BaseModel):
    """Snapshot of inventory health."""
    total_products: int
    active_products: int
    out_of_stock_count: int
    low_stock_count: int
    total_inventory_value: float
