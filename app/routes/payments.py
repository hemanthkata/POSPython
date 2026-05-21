"""Stripe payment gateway routes: checkout sessions and webhooks."""

import json
import stripe

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.models.transaction import TransactionStatus
from app.schemas.transaction import CartRequest, ReceiptResponse
from app.services import transaction_service
from app.utils.dependencies import get_current_user

settings = get_settings()
stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/payments", tags=["Payments & Stripe"])


@router.post(
    "/create-checkout-session",
    summary="Create Stripe Checkout Session",
    description=(
        "Initialize a Stripe Checkout Session from the current cart. "
        "Returns a session URL to redirect the customer for payment."
    ),
)
async def create_checkout_session(
    cart: CartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout session for the given cart items."""
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.",
        )

    # Build line items for Stripe from cart products
    from app.models.product import Product
    from sqlalchemy import select

    line_items = []
    metadata_items = []

    for cart_item in cart.items:
        result = await db.execute(
            select(Product).where(Product.id == cart_item.product_id)
        )
        product = result.scalar_one_or_none()
        if product is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {cart_item.product_id} not found",
            )

        line_items.append({
            "price_data": {
                "currency": "usd",
                "product_data": {
                    "name": product.name,
                    "description": product.description or product.category.value,
                },
                "unit_amount": int(product.price * 100),  # Stripe uses cents
            },
            "quantity": cart_item.quantity,
        })
        metadata_items.append({
            "product_id": product.id,
            "quantity": cart_item.quantity,
        })

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=line_items,
            mode="payment",
            success_url=settings.STRIPE_SUCCESS_URL,
            cancel_url=settings.STRIPE_CANCEL_URL,
            metadata={
                "cashier_id": str(current_user.id),
                "discount_percent": str(cart.discount_percent),
                "payment_method": "card",
                "cart_items": json.dumps(metadata_items),
            },
        )

        return {
            "session_id": session.id,
            "checkout_url": session.url,
            "publishable_key": settings.STRIPE_PUBLISHABLE_KEY,
        }

    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}",
        )


@router.post(
    "/webhook",
    summary="Stripe Webhook Handler",
    description=(
        "Receives Stripe webhook events for payment confirmation. "
        "Processes the order when `checkout.session.completed` is received."
    ),
)
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Stripe webhook events for payment confirmation."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if settings.STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        # For development without webhook secret verification
        event = json.loads(payload)

    # Handle the checkout.session.completed event
    if event.get("type") == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata", {})

        cashier_id = int(metadata.get("cashier_id", 1))
        discount_percent = float(metadata.get("discount_percent", 0))
        cart_items_raw = metadata.get("cart_items", "[]")
        cart_items = json.loads(cart_items_raw)

        # Build CartRequest and process the order
        from app.schemas.transaction import CartItem
        from app.models.transaction import PaymentMethod

        cart_request = CartRequest(
            items=[CartItem(**item) for item in cart_items],
            payment_method=PaymentMethod.CARD,
            discount_percent=discount_percent,
            notes=f"Stripe Session: {session.get('id', 'N/A')}",
        )

        # Retrieve cashier user
        from sqlalchemy import select
        from app.models.user import User

        result = await db.execute(select(User).where(User.id == cashier_id))
        cashier = result.scalar_one_or_none()

        if cashier:
            try:
                await transaction_service.process_checkout(db, cart_request, cashier)
            except ValueError:
                pass  # Log but don't fail the webhook

    return {"status": "received"}
