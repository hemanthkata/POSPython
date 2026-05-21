"""PDF Invoice generator using ReportLab.

Generates professional PDF receipts/invoices for transactions.
"""

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)
from reportlab.lib.enums import TA_CENTER, TA_RIGHT


def generate_invoice_pdf(
    transaction_id: str,
    cashier_name: str,
    items: list[dict],
    subtotal: float,
    tax_amount: float,
    discount_amount: float,
    total_amount: float,
    payment_method: str,
    created_at: datetime | str | None = None,
) -> bytes:
    """Generate a PDF invoice for a transaction.

    Args:
        transaction_id: UUID string of the transaction.
        cashier_name: Name of the cashier.
        items: List of dicts with product_name, quantity, unit_price, line_total.
        subtotal: Order subtotal.
        tax_amount: Tax charged.
        discount_amount: Discount applied.
        total_amount: Final total.
        payment_method: Payment method used.
        created_at: Transaction timestamp.

    Returns:
        PDF file content as bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=30 * mm,
        leftMargin=30 * mm,
        topMargin=30 * mm,
        bottomMargin=30 * mm,
    )

    styles = getSampleStyleSheet()
    elements = []

    # Custom styles
    title_style = ParagraphStyle(
        "InvoiceTitle",
        parent=styles["Heading1"],
        fontSize=28,
        textColor=colors.HexColor("#6366f1"),
        spaceAfter=4,
        alignment=TA_CENTER,
    )
    subtitle_style = ParagraphStyle(
        "InvoiceSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#6b7280"),
        alignment=TA_CENTER,
        spaceAfter=20,
    )
    heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=12,
        textColor=colors.HexColor("#374151"),
        spaceBefore=16,
        spaceAfter=8,
    )
    normal_style = ParagraphStyle(
        "InvoiceNormal",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#4b5563"),
    )
    right_style = ParagraphStyle(
        "RightAligned",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#4b5563"),
        alignment=TA_RIGHT,
    )

    # ── Header ────────────────────────────────────────────────────────────
    elements.append(Paragraph("FastPOS", title_style))
    elements.append(Paragraph("Point of Sale — Tax Invoice", subtitle_style))
    elements.append(HRFlowable(
        width="100%", thickness=2, color=colors.HexColor("#6366f1"),
        spaceAfter=16, spaceBefore=0,
    ))

    # ── Invoice Details ───────────────────────────────────────────────────
    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            created_at = datetime.utcnow()
    elif created_at is None:
        created_at = datetime.utcnow()

    detail_data = [
        ["Invoice #:", transaction_id[:8].upper()],
        ["Full ID:", transaction_id],
        ["Date:", created_at.strftime("%B %d, %Y %I:%M %p")],
        ["Cashier:", cashier_name],
        ["Payment:", payment_method.upper()],
    ]
    detail_table = Table(detail_data, colWidths=[80, None])
    detail_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#374151")),
        ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#4b5563")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(detail_table)
    elements.append(Spacer(1, 16))

    # ── Line Items Table ──────────────────────────────────────────────────
    elements.append(Paragraph("Order Items", heading_style))

    header_row = ["#", "Product", "Qty", "Unit Price", "Total"]
    table_data = [header_row]

    for i, item in enumerate(items, 1):
        table_data.append([
            str(i),
            item.get("product_name", "Unknown"),
            str(item.get("quantity", 0)),
            f"${item.get('unit_price', 0):.2f}",
            f"${item.get('line_total', 0):.2f}",
        ])

    items_table = Table(
        table_data,
        colWidths=[30, None, 50, 80, 80],
        repeatRows=1,
    )
    items_table.setStyle(TableStyle([
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 8),

        # Data rows
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
        ("TOPPADDING", (0, 1), (-1, -1), 6),
        ("ALIGN", (2, 1), (2, -1), "CENTER"),
        ("ALIGN", (3, 1), (4, -1), "RIGHT"),

        # Alternating row colors
        *[
            ("BACKGROUND", (0, row), (-1, row), colors.HexColor("#f9fafb"))
            for row in range(2, len(table_data), 2)
        ],

        # Grid
        ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#4f46e5")),
        ("LINEBELOW", (0, -1), (-1, -1), 1, colors.HexColor("#e5e7eb")),
        ("LINEBELOW", (0, 1), (-1, -2), 0.5, colors.HexColor("#f3f4f6")),

        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 16))

    # ── Totals ────────────────────────────────────────────────────────────
    elements.append(HRFlowable(
        width="100%", thickness=0.5, color=colors.HexColor("#e5e7eb"),
        spaceAfter=8, spaceBefore=0,
    ))

    totals_data = [
        ["Subtotal:", f"${subtotal:.2f}"],
        ["Discount:", f"-${discount_amount:.2f}"],
        ["Tax:", f"${tax_amount:.2f}"],
    ]
    totals_table = Table(totals_data, colWidths=[None, 100])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (0, -1), "RIGHT"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#6b7280")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(totals_table)

    # Total row (bold, colored)
    total_data = [["TOTAL:", f"${total_amount:.2f}"]]
    total_table = Table(total_data, colWidths=[None, 100])
    total_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 14),
        ("TEXTCOLOR", (0, 0), (0, 0), colors.HexColor("#374151")),
        ("TEXTCOLOR", (1, 0), (1, 0), colors.HexColor("#6366f1")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("LINEABOVE", (0, 0), (-1, 0), 1.5, colors.HexColor("#6366f1")),
    ]))
    elements.append(total_table)
    elements.append(Spacer(1, 30))

    # ── Footer ────────────────────────────────────────────────────────────
    footer_style = ParagraphStyle(
        "Footer",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#9ca3af"),
        alignment=TA_CENTER,
    )
    elements.append(HRFlowable(
        width="100%", thickness=0.5, color=colors.HexColor("#e5e7eb"),
        spaceAfter=8, spaceBefore=0,
    ))
    elements.append(Paragraph("Thank you for your purchase!", footer_style))
    elements.append(Paragraph(
        f"Generated by FastPOS v2.0 | {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        footer_style,
    ))

    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
