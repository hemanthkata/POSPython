"""Transaction processing service: cart checkout and stock synchronization."""

from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models.product import Product
from app.models.transaction import Transaction, TransactionItem, TransactionStatus
from app.models.user import User
from app.schemas.transaction import CartRequest

settings = get_settings()


async def process_checkout(
    db: AsyncSession, cart: CartRequest, cashier: User
) -> Transaction:
    """Process a cart checkout: validate stock, create transaction, deduct inventory.

    This is the core business logic that:
    1. Validates all products exist and have sufficient stock.
    2. Creates a Transaction with line items.
    3. Calculates subtotal, tax, discount, and total.
    4. Deducts stock quantities atomically.

    Args:
        db: Database session.
        cart: Cart request with items and payment info.
        cashier: The authenticated cashier user.

    Returns:
        The completed Transaction with items loaded.

    Raises:
        ValueError: If any product is invalid or has insufficient stock.
    """
    # ── Step 1: Validate all items and gather products ────────────────────
    line_items_data = []

    for cart_item in cart.items:
        result = await db.execute(
            select(Product)
            .where(Product.id == cart_item.product_id)
            .with_for_update()
        )
        product = result.scalar_one_or_none()

        if product is None:
            raise ValueError(f"Product with ID {cart_item.product_id} not found")

        if not product.is_active:
            raise ValueError(f"Product '{product.name}' is no longer available")

        if product.stock_quantity < cart_item.quantity:
            raise ValueError(
                f"Insufficient stock for '{product.name}'. "
                f"Available: {product.stock_quantity}, Requested: {cart_item.quantity}"
            )

        line_total = round(product.price * cart_item.quantity, 2)
        line_items_data.append({
            "product": product,
            "product_id": product.id,
            "product_name": product.name,
            "quantity": cart_item.quantity,
            "unit_price": product.price,
            "line_total": line_total,
        })

    # ── Step 2: Calculate totals ──────────────────────────────────────────
    subtotal = round(sum(item["line_total"] for item in line_items_data), 2)
    discount_amount = round(subtotal * (cart.discount_percent / 100), 2)
    taxable_amount = subtotal - discount_amount
    tax_amount = round(taxable_amount * (settings.TAX_RATE / 100), 2)
    total_amount = round(taxable_amount + tax_amount, 2)

    # ── Step 3: Create transaction ────────────────────────────────────────
    transaction = Transaction(
        cashier_id=cashier.id,
        status=TransactionStatus.COMPLETED,
        payment_method=cart.payment_method,
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount_amount=discount_amount,
        total_amount=total_amount,
        notes=cart.notes,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(transaction)
    await db.flush()  # Get the transaction ID

    # ── Step 4: Create line items ─────────────────────────────────────────
    for item_data in line_items_data:
        transaction_item = TransactionItem(
            transaction_id=transaction.id,
            product_id=item_data["product_id"],
            product_name=item_data["product_name"],
            quantity=item_data["quantity"],
            unit_price=item_data["unit_price"],
            line_total=item_data["line_total"],
        )
        db.add(transaction_item)

    # ── Step 5: Deduct stock ──────────────────────────────────────────────
    for item_data in line_items_data:
        product = item_data["product"]
        product.stock_quantity -= item_data["quantity"]

    await db.flush()

    # Reload with items relationship
    await db.refresh(transaction)
    result = await db.execute(
        select(Transaction)
        .where(Transaction.id == transaction.id)
        .options(selectinload(Transaction.items))
    )
    transaction = result.scalar_one()

    return transaction


async def get_transaction(db: AsyncSession, transaction_id: str) -> Transaction | None:
    """Retrieve a transaction by its UUID."""
    result = await db.execute(
        select(Transaction)
        .where(Transaction.transaction_id == transaction_id)
        .options(selectinload(Transaction.items))
    )
    return result.scalar_one_or_none()


async def list_transactions(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    cashier_id: int | None = None,
    status: TransactionStatus | None = None,
) -> tuple[list[Transaction], int]:
    """List transactions with filtering and pagination.

    Returns:
        Tuple of (list of transactions, total count).
    """
    offset = (page - 1) * page_size
    query = select(Transaction).options(selectinload(Transaction.items))
    count_query = select(func.count(Transaction.id))

    if cashier_id:
        query = query.where(Transaction.cashier_id == cashier_id)
        count_query = count_query.where(Transaction.cashier_id == cashier_id)

    if status:
        query = query.where(Transaction.status == status)
        count_query = count_query.where(Transaction.status == status)

    count_result = await db.execute(count_query)
    total = count_result.scalar()

    result = await db.execute(
        query.order_by(Transaction.created_at.desc()).offset(offset).limit(page_size)
    )
    transactions = list(result.scalars().unique().all())

    return transactions, total


async def refund_transaction(db: AsyncSession, transaction_id: str) -> Transaction | None:
    """Refund a completed transaction and restore stock.

    Returns:
        The refunded Transaction, or None if not found/already refunded.
    """
    transaction = await get_transaction(db, transaction_id)
    if transaction is None:
        return None

    if transaction.status != TransactionStatus.COMPLETED:
        raise ValueError(
            f"Cannot refund transaction with status '{transaction.status.value}'. "
            "Only completed transactions can be refunded."
        )

    # Restore stock for each item
    for item in transaction.items:
        result = await db.execute(
            select(Product)
            .where(Product.id == item.product_id)
            .with_for_update()
        )
        product = result.scalar_one_or_none()
        if product:
            product.stock_quantity += item.quantity

    transaction.status = TransactionStatus.REFUNDED
    await db.flush()
    await db.refresh(transaction)

    return transaction
