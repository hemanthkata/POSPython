"""Reporting, analytics, and data export routes."""

import csv
import io
import json
from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse, JSONResponse
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


# ── Data Export Endpoints ─────────────────────────────────────────────────────


@router.get(
    "/export/csv",
    summary="Export sales report as CSV",
    description="Download sales data for a date range as a CSV file. Includes daily breakdown and top products.",
    dependencies=[Depends(get_current_admin)],
)
async def export_sales_csv(
    start_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    """Export sales analytics data as a downloadable CSV file."""
    report = await report_service.get_sales_summary(db, start_date, end_date)

    output = io.StringIO()
    writer = csv.writer(output)

    # Summary section
    writer.writerow(["FastPOS Sales Report"])
    writer.writerow(["Period", f"{start_date} to {end_date}"])
    writer.writerow(["Total Revenue", f"${report.total_revenue:.2f}"])
    writer.writerow(["Total Transactions", report.total_transactions])
    writer.writerow(["Total Items Sold", report.total_items_sold])
    writer.writerow(["Average Daily Revenue", f"${report.average_daily_revenue:.2f}"])
    writer.writerow([])

    # Daily breakdown
    writer.writerow(["=== Daily Breakdown ==="])
    writer.writerow(["Date", "Revenue", "Transactions", "Items Sold", "Avg Transaction Value"])
    for day in report.daily_breakdown:
        writer.writerow([
            day.date.isoformat(),
            f"${day.total_revenue:.2f}",
            day.total_transactions,
            day.total_items_sold,
            f"${day.average_transaction_value:.2f}",
        ])
    writer.writerow([])

    # Top products
    writer.writerow(["=== Top Selling Products ==="])
    writer.writerow(["Rank", "Product", "Quantity Sold", "Revenue"])
    for i, product in enumerate(report.top_products, 1):
        writer.writerow([
            i,
            product.product_name,
            product.total_quantity_sold,
            f"${product.total_revenue:.2f}",
        ])

    output.seek(0)
    filename = f"fastpos_sales_{start_date}_{end_date}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/export/json",
    summary="Export sales report as JSON",
    description="Download raw sales analytics data for a date range as a structured JSON file.",
    dependencies=[Depends(get_current_admin)],
)
async def export_sales_json(
    start_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    """Export sales analytics data as a downloadable JSON file."""
    report = await report_service.get_sales_summary(db, start_date, end_date)

    export_data = {
        "report_type": "sales_summary",
        "generated_at": date.today().isoformat(),
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        "summary": {
            "total_revenue": report.total_revenue,
            "total_transactions": report.total_transactions,
            "total_items_sold": report.total_items_sold,
            "average_daily_revenue": report.average_daily_revenue,
        },
        "top_products": [
            {
                "rank": i,
                "product_id": p.product_id,
                "product_name": p.product_name,
                "total_quantity_sold": p.total_quantity_sold,
                "total_revenue": p.total_revenue,
            }
            for i, p in enumerate(report.top_products, 1)
        ],
        "daily_breakdown": [
            {
                "date": day.date.isoformat(),
                "total_revenue": day.total_revenue,
                "total_transactions": day.total_transactions,
                "total_items_sold": day.total_items_sold,
                "average_transaction_value": day.average_transaction_value,
            }
            for day in report.daily_breakdown
        ],
    }

    json_str = json.dumps(export_data, indent=2)
    filename = f"fastpos_sales_{start_date}_{end_date}.json"

    return StreamingResponse(
        iter([json_str]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
