"""Product/Inventory management routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.product import Category
from app.schemas.product import (
    ProductCreate,
    ProductResponse,
    ProductListResponse,
    ProductUpdate,
    StockAdjustment,
)
from app.services import product_service
from app.utils.dependencies import get_current_user, get_current_admin

router = APIRouter(prefix="/products", tags=["Inventory Management"])


@router.post(
    "/",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new product (Admin)",
    dependencies=[Depends(get_current_admin)],
)
async def create_product(
    product_data: ProductCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new product in the inventory. Admin access required."""
    try:
        product = await product_service.create_product(db, product_data)
        return product
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.get(
    "/",
    response_model=ProductListResponse,
    summary="List products",
    dependencies=[Depends(get_current_user)],
)
async def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Category | None = Query(None),
    search: str | None = Query(None, max_length=100),
    in_stock_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """List products with optional filters. Authenticated users only."""
    products, total = await product_service.list_products(
        db, page=page, page_size=page_size,
        category=category, search=search, in_stock_only=in_stock_only,
    )
    return ProductListResponse(
        products=products, total=total, page=page, page_size=page_size,
    )


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Get product details",
    dependencies=[Depends(get_current_user)],
)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific product by its ID."""
    product = await product_service.get_product_by_id(db, product_id)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found",
        )
    return product


@router.put(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Update product (Admin)",
    dependencies=[Depends(get_current_admin)],
)
async def update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a product's details. Admin access required."""
    product = await product_service.update_product(db, product_id, product_data)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found",
        )
    return product


@router.patch(
    "/{product_id}/stock",
    response_model=ProductResponse,
    summary="Adjust product stock (Admin)",
    dependencies=[Depends(get_current_admin)],
)
async def adjust_stock(
    product_id: int,
    adjustment: StockAdjustment,
    db: AsyncSession = Depends(get_db),
):
    """Manually adjust stock for a product. Admin access required."""
    try:
        product = await product_service.adjust_stock(db, product_id, adjustment.quantity)
        if product is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {product_id} not found",
            )
        return product
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_200_OK,
    summary="Deactivate product (Admin)",
    dependencies=[Depends(get_current_admin)],
)
async def deactivate_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a product (soft delete). Admin access required."""
    success = await product_service.delete_product(db, product_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found",
        )
    return {"message": f"Product {product_id} has been deactivated"}
