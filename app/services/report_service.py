"""Reporting and analytics service."""

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.models.transaction import Transaction, TransactionItem, TransactionStatus
from app.schemas.report import (
    DailySalesReport,
    TopSellingProduct,
    SalesSummaryReport,
    InventorySummary,
)


def _date_to_range(target_date: date) -> tuple[datetime, datetime]:
    """Convert a date to a UTC datetime range (start of day to end of day)."""
    start = datetime(target_date.year, target_date.month, target_date.day, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return start, end


async def get_daily_sales(db: AsyncSession, target_date: date) -> DailySalesReport:
    """Generate a sales report for a specific day.

    Returns:
        DailySalesReport with revenue, transaction count, and items sold.
    """
    day_start, day_end = _date_to_range(target_date)

    # Query completed transactions for the target date
    result = await db.execute(
        select(
            func.coalesce(func.sum(Transaction.total_amount), 0.0).label("revenue"),
            func.count(Transaction.id).label("tx_count"),
        ).where(
            and_(
                Transaction.created_at >= day_start,
                Transaction.created_at < day_end,
                Transaction.status == TransactionStatus.COMPLETED,
            )
        )
    )
    row = result.one()
    total_revenue = float(row.revenue)
    total_transactions = int(row.tx_count)

    # Count total items sold
    items_result = await db.execute(
        select(func.coalesce(func.sum(TransactionItem.quantity), 0)).where(
            TransactionItem.transaction_id.in_(
                select(Transaction.id).where(
                    and_(
                        Transaction.created_at >= day_start,
                        Transaction.created_at < day_end,
                        Transaction.status == TransactionStatus.COMPLETED,
                    )
                )
            )
        )
    )
    total_items_sold = int(items_result.scalar())

    avg_value = round(total_revenue / total_transactions, 2) if total_transactions > 0 else 0.0

    return DailySalesReport(
        date=target_date,
        total_revenue=round(total_revenue, 2),
        total_transactions=total_transactions,
        total_items_sold=total_items_sold,
        average_transaction_value=avg_value,
    )


async def get_top_selling_products(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    limit: int = 10,
) -> list[TopSellingProduct]:
    """Get the top-selling products by quantity within a date range.

    Returns:
        List of TopSellingProduct sorted by total quantity sold descending.
    """
    range_start, _ = _date_to_range(start_date)
    _, range_end = _date_to_range(end_date)

    result = await db.execute(
        select(
            TransactionItem.product_id,
            TransactionItem.product_name,
            func.sum(TransactionItem.quantity).label("total_qty"),
            func.sum(TransactionItem.line_total).label("total_rev"),
        )
        .join(Transaction, TransactionItem.transaction_id == Transaction.id)
        .where(
            and_(
                Transaction.created_at >= range_start,
                Transaction.created_at < range_end,
                Transaction.status == TransactionStatus.COMPLETED,
            )
        )
        .group_by(TransactionItem.product_id, TransactionItem.product_name)
        .order_by(func.sum(TransactionItem.quantity).desc())
        .limit(limit)
    )

    return [
        TopSellingProduct(
            product_id=row.product_id,
            product_name=row.product_name,
            total_quantity_sold=int(row.total_qty),
            total_revenue=round(float(row.total_rev), 2),
        )
        for row in result.all()
    ]


async def get_sales_summary(
    db: AsyncSession,
    start_date: date,
    end_date: date,
) -> SalesSummaryReport:
    """Generate a comprehensive sales summary for a date range.

    Includes daily breakdown, top products, and aggregate metrics.
    """
    # Generate daily breakdown
    daily_reports = []
    current_date = start_date
    total_revenue = 0.0
    total_transactions = 0
    total_items = 0

    while current_date <= end_date:
        daily = await get_daily_sales(db, current_date)
        daily_reports.append(daily)
        total_revenue += daily.total_revenue
        total_transactions += daily.total_transactions
        total_items += daily.total_items_sold
        current_date += timedelta(days=1)

    num_days = (end_date - start_date).days + 1
    avg_daily = round(total_revenue / num_days, 2) if num_days > 0 else 0.0

    # Get top products
    top_products = await get_top_selling_products(db, start_date, end_date)

    return SalesSummaryReport(
        start_date=start_date,
        end_date=end_date,
        total_revenue=round(total_revenue, 2),
        total_transactions=total_transactions,
        total_items_sold=total_items,
        average_daily_revenue=avg_daily,
        top_products=top_products,
        daily_breakdown=daily_reports,
    )


async def get_inventory_summary(db: AsyncSession) -> InventorySummary:
    """Generate a snapshot of current inventory health.

    Returns:
        InventorySummary with stock counts and valuation.
    """
    # Total and active products
    total_result = await db.execute(select(func.count(Product.id)))
    total_products = int(total_result.scalar())

    active_result = await db.execute(
        select(func.count(Product.id)).where(Product.is_active == True)
    )
    active_products = int(active_result.scalar())

    # Out of stock
    oos_result = await db.execute(
        select(func.count(Product.id)).where(
            and_(Product.is_active == True, Product.stock_quantity <= 0)
        )
    )
    out_of_stock = int(oos_result.scalar())

    # Low stock (at or below threshold but not zero)
    low_result = await db.execute(
        select(func.count(Product.id)).where(
            and_(
                Product.is_active == True,
                Product.stock_quantity > 0,
                Product.stock_quantity <= Product.low_stock_threshold,
            )
        )
    )
    low_stock = int(low_result.scalar())

    # Total inventory value (cost basis)
    value_result = await db.execute(
        select(
            func.coalesce(
                func.sum(Product.cost_price * Product.stock_quantity), 0.0
            )
        ).where(Product.is_active == True)
    )
    total_value = round(float(value_result.scalar()), 2)

    return InventorySummary(
        total_products=total_products,
        active_products=active_products,
        out_of_stock_count=out_of_stock,
        low_stock_count=low_stock,
        total_inventory_value=total_value,
    )
