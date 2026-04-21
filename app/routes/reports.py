"""Reporting and analytics routes."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.report import DailySalesReport, SalesSummaryReport, InventorySummary
from app.services import report_service
from app.utils.dependencies import get_current_user, get_current_admin

router = APIRouter(prefix="/reports", tags=["Reporting & Analytics"])


@router.get(
    "/sales/daily",
    response_model=DailySalesReport,
    summary="Daily sales report",
    dependencies=[Depends(get_current_admin)],
)
async def daily_sales_report(
    target_date: date = Query(default_factory=date.today, description="Date for the report (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    """Get sales report for a specific day. Admin access required."""
    return await report_service.get_daily_sales(db, target_date)


@router.get(
    "/sales/summary",
    response_model=SalesSummaryReport,
    summary="Sales summary report",
    dependencies=[Depends(get_current_admin)],
)
async def sales_summary_report(
    start_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    """Get comprehensive sales summary for a date range. Admin access required."""
    return await report_service.get_sales_summary(db, start_date, end_date)


@router.get(
    "/inventory",
    response_model=InventorySummary,
    summary="Inventory health snapshot",
    dependencies=[Depends(get_current_user)],
)
async def inventory_summary(
    db: AsyncSession = Depends(get_db),
):
    """Get a snapshot of current inventory health. Authenticated users only."""
    return await report_service.get_inventory_summary(db)
