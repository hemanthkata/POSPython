"""Transaction and checkout routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

import io

from app.database import get_db
from app.models.user import User
from app.models.transaction import TransactionStatus
from app.schemas.transaction import (
    CartRequest,
    TransactionResponse,
    TransactionListResponse,
    ReceiptResponse,
)
from app.services import transaction_service
from app.utils.dependencies import get_current_user, get_current_admin
from app.utils.pdf_generator import generate_invoice_pdf

router = APIRouter(prefix="/transactions", tags=["Sales & Transactions"])


@router.post(
    "/checkout",
    response_model=ReceiptResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Process checkout",
    description="Process a cart checkout: validates stock, calculates totals with tax/discount, creates the transaction, and deducts inventory.",
)
async def checkout(
    cart: CartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Process a customer checkout."""
    try:
        transaction = await transaction_service.process_checkout(db, cart, current_user)

        # Queue email confirmation via Celery (non-blocking, best-effort)
        try:
            from app.tasks.email_tasks import send_order_confirmation_email
            items_data = [
                {
                    "product_name": item.product_name,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "line_total": item.line_total,
                }
                for item in transaction.items
            ]
            send_order_confirmation_email.delay(
                recipient_email=current_user.email,
                transaction_id=transaction.transaction_id,
                cashier_name=current_user.full_name,
                items=items_data,
                subtotal=transaction.subtotal,
                tax_amount=transaction.tax_amount,
                discount_amount=transaction.discount_amount,
                total_amount=transaction.total_amount,
                payment_method=transaction.payment_method.value,
            )
        except Exception:
            pass  # Celery/Redis not available — checkout still succeeds

        return ReceiptResponse(
            transaction_id=transaction.transaction_id,
            status=transaction.status.value,
            items=transaction.items,
            subtotal=transaction.subtotal,
            tax_amount=transaction.tax_amount,
            discount_amount=transaction.discount_amount,
            total_amount=transaction.total_amount,
            payment_method=transaction.payment_method.value,
            cashier=current_user.full_name,
            timestamp=transaction.created_at,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/",
    response_model=TransactionListResponse,
    summary="List transactions",
)
async def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    cashier_id: int | None = Query(None),
    status: TransactionStatus | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List transactions. Cashiers see only their own; Admins see all."""
    # Cashiers can only see their own transactions
    effective_cashier_id = cashier_id
    if current_user.role.value != "admin":
        effective_cashier_id = current_user.id

    transactions, total = await transaction_service.list_transactions(
        db, page=page, page_size=page_size,
        cashier_id=effective_cashier_id, status=status,
    )
    return TransactionListResponse(
        transactions=transactions, total=total, page=page, page_size=page_size,
    )


@router.get(
    "/{transaction_id}",
    response_model=TransactionResponse,
    summary="Get transaction details",
)
async def get_transaction(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific transaction by its UUID."""
    transaction = await transaction_service.get_transaction(db, transaction_id)
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction '{transaction_id}' not found",
        )

    # Cashiers can only view their own transactions
    if current_user.role.value != "admin" and transaction.cashier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own transactions",
        )

    return transaction


@router.get(
    "/{transaction_id}/invoice",
    summary="Download PDF invoice",
    description="Generate and download a PDF invoice for a specific transaction.",
)
async def download_invoice(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate and stream a PDF invoice for a transaction."""
    transaction = await transaction_service.get_transaction(db, transaction_id)
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction '{transaction_id}' not found",
        )

    # Cashiers can only download their own invoices
    if current_user.role.value != "admin" and transaction.cashier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own invoices",
        )

    items_data = [
        {
            "product_name": item.product_name,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "line_total": item.line_total,
        }
        for item in transaction.items
    ]

    pdf_bytes = generate_invoice_pdf(
        transaction_id=transaction.transaction_id,
        cashier_name=current_user.full_name,
        items=items_data,
        subtotal=transaction.subtotal,
        tax_amount=transaction.tax_amount,
        discount_amount=transaction.discount_amount,
        total_amount=transaction.total_amount,
        payment_method=transaction.payment_method.value,
        created_at=transaction.created_at,
    )

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=invoice_{transaction_id[:8]}.pdf",
        },
    )


@router.post(
    "/{transaction_id}/refund",
    response_model=TransactionResponse,
    summary="Refund a transaction (Admin)",
    dependencies=[Depends(get_current_admin)],
)
async def refund_transaction(
    transaction_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Refund a completed transaction and restore stock. Admin access required."""
    try:
        transaction = await transaction_service.refund_transaction(db, transaction_id)
        if transaction is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Transaction '{transaction_id}' not found",
            )
        return transaction
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
