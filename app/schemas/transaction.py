"""Pydantic schemas for transactions and cart management."""

from datetime import datetime
from pydantic import BaseModel, Field

from app.models.transaction import TransactionStatus, PaymentMethod


# ── Cart Schemas ──────────────────────────────────────────────────────────────

class CartItem(BaseModel):
    """A single item in the cart."""
    product_id: int = Field(..., gt=0, examples=[1])
    quantity: int = Field(..., gt=0, le=1000, examples=[2])


class CartRequest(BaseModel):
    """Cart containing one or more items for checkout."""
    items: list[CartItem] = Field(..., min_length=1)
    payment_method: PaymentMethod = Field(default=PaymentMethod.CASH)
    discount_percent: float = Field(default=0.0, ge=0, le=100, examples=[5.0])
    notes: str | None = Field(None, max_length=500)


# ── Transaction Response Schemas ──────────────────────────────────────────────

class TransactionItemResponse(BaseModel):
    """Line item detail within a transaction."""
    id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price: float
    line_total: float

    model_config = {"from_attributes": True}


class TransactionResponse(BaseModel):
    """Full transaction record."""
    id: int
    transaction_id: str
    cashier_id: int
    status: TransactionStatus
    payment_method: PaymentMethod
    subtotal: float
    tax_amount: float
    discount_amount: float
    total_amount: float
    notes: str | None
    items: list[TransactionItemResponse]
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    """Paginated list of transactions."""
    transactions: list[TransactionResponse]
    total: int
    page: int
    page_size: int


class ReceiptResponse(BaseModel):
    """Simplified receipt-style response after checkout."""
    transaction_id: str
    status: str
    items: list[TransactionItemResponse]
    subtotal: float
    tax_amount: float
    discount_amount: float
    total_amount: float
    payment_method: str
    cashier: str
    timestamp: datetime
