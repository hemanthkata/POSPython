"""Celery tasks for asynchronous email delivery.

Handles order confirmation emails with optional PDF invoice attachments.
Emails are queued via Celery and delivered through SMTP in the background.
"""

import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication

from app.worker import celery_app
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    name="send_order_confirmation_email",
)
def send_order_confirmation_email(
    self,
    recipient_email: str,
    transaction_id: str,
    cashier_name: str,
    items: list[dict],
    subtotal: float,
    tax_amount: float,
    discount_amount: float,
    total_amount: float,
    payment_method: str,
    pdf_invoice_path: str | None = None,
):
    """Send an order confirmation email with receipt details.

    Args:
        recipient_email: Customer email address.
        transaction_id: UUID of the transaction.
        cashier_name: Name of the cashier who processed the sale.
        items: List of dicts with product_name, quantity, unit_price, line_total.
        subtotal: Order subtotal before tax/discount.
        tax_amount: Tax applied.
        discount_amount: Discount applied.
        total_amount: Final total charged.
        payment_method: Payment method used.
        pdf_invoice_path: Optional path to the generated PDF invoice file.
    """
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        logger.warning(
            "SMTP credentials not configured — skipping email for transaction %s",
            transaction_id,
        )
        return {"status": "skipped", "reason": "SMTP not configured"}

    try:
        msg = MIMEMultipart("mixed")
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = recipient_email
        msg["Subject"] = f"FastPOS — Order Confirmation #{transaction_id[:8]}"

        # Build HTML email body
        items_html = "".join(
            f"<tr>"
            f"<td style='padding:8px;border-bottom:1px solid #eee;'>{item['product_name']}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:center;'>{item['quantity']}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right;'>${item['unit_price']:.2f}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right;'>${item['line_total']:.2f}</td>"
            f"</tr>"
            for item in items
        )

        html_body = f"""
        <html>
        <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
            <div style="text-align:center;padding:20px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;margin-bottom:24px;">
                <h1 style="color:white;margin:0;font-size:28px;">FastPOS</h1>
                <p style="color:rgba(255,255,255,0.85);margin:4px 0 0 0;">Order Confirmation</p>
            </div>

            <p>Thank you for your purchase! Here's your receipt:</p>

            <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;">
                <p style="margin:0;"><strong>Transaction ID:</strong> {transaction_id}</p>
                <p style="margin:4px 0 0;"><strong>Payment Method:</strong> {payment_method.upper()}</p>
                <p style="margin:4px 0 0;"><strong>Cashier:</strong> {cashier_name}</p>
            </div>

            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <thead>
                    <tr style="background:#f3f4f6;">
                        <th style="padding:8px;text-align:left;">Item</th>
                        <th style="padding:8px;text-align:center;">Qty</th>
                        <th style="padding:8px;text-align:right;">Price</th>
                        <th style="padding:8px;text-align:right;">Total</th>
                    </tr>
                </thead>
                <tbody>{items_html}</tbody>
            </table>

            <div style="border-top:2px solid #e5e7eb;padding-top:12px;margin-top:8px;">
                <p style="display:flex;justify-content:space-between;margin:4px 0;">
                    <span>Subtotal:</span><span>${subtotal:.2f}</span>
                </p>
                <p style="display:flex;justify-content:space-between;margin:4px 0;">
                    <span>Discount:</span><span>-${discount_amount:.2f}</span>
                </p>
                <p style="display:flex;justify-content:space-between;margin:4px 0;">
                    <span>Tax:</span><span>${tax_amount:.2f}</span>
                </p>
                <p style="display:flex;justify-content:space-between;margin:8px 0 0;font-size:18px;font-weight:bold;color:#6366f1;">
                    <span>Total:</span><span>${total_amount:.2f}</span>
                </p>
            </div>

            <p style="text-align:center;margin-top:24px;color:#9ca3af;font-size:12px;">
                This is an automated receipt from FastPOS. Do not reply to this email.
            </p>
        </body>
        </html>
        """

        msg.attach(MIMEText(html_body, "html"))

        # Attach PDF invoice if provided
        if pdf_invoice_path:
            try:
                with open(pdf_invoice_path, "rb") as f:
                    pdf_attachment = MIMEApplication(f.read(), _subtype="pdf")
                    pdf_attachment.add_header(
                        "Content-Disposition",
                        "attachment",
                        filename=f"invoice_{transaction_id[:8]}.pdf",
                    )
                    msg.attach(pdf_attachment)
            except FileNotFoundError:
                logger.warning("PDF invoice not found at %s", pdf_invoice_path)

        # Send via SMTP
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info("Order confirmation email sent to %s for transaction %s",
                     recipient_email, transaction_id)
        return {"status": "sent", "recipient": recipient_email}

    except Exception as exc:
        logger.error("Failed to send email: %s", str(exc))
        raise self.retry(exc=exc)
