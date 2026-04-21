"""Pydantic schemas for product/inventory management."""

from datetime import datetime
from pydantic import BaseModel, Field

from app.models.product import Category


class ProductCreate(BaseModel):
    """Schema for creating a new product."""
    name: str = Field(..., min_length=1, max_length=150, examples=["Espresso Coffee"])
    sku: str = Field(..., min_length=1, max_length=50, examples=["BEV-ESP-001"])
    description: str | None = Field(None, max_length=500, examples=["Rich Italian espresso"])
    category: Category = Field(default=Category.OTHER, examples=[Category.BEVERAGE])
    price: float = Field(..., gt=0, examples=[4.99])
    cost_price: float = Field(default=0.0, ge=0, examples=[2.50])
    stock_quantity: int = Field(default=0, ge=0, examples=[100])
    low_stock_threshold: int = Field(default=10, ge=0, examples=[10])


class ProductUpdate(BaseModel):
    """Schema for updating an existing product. All fields optional."""
    name: str | None = Field(None, min_length=1, max_length=150)
    description: str | None = Field(None, max_length=500)
    category: Category | None = None
    price: float | None = Field(None, gt=0)
    cost_price: float | None = Field(None, ge=0)
    stock_quantity: int | None = Field(None, ge=0)
    low_stock_threshold: int | None = Field(None, ge=0)
    is_active: bool | None = None


class ProductResponse(BaseModel):
    """Schema for product data returned in API responses."""
    id: int
    name: str
    sku: str
    description: str | None
    category: Category
    price: float
    cost_price: float
    stock_quantity: int
    low_stock_threshold: int
    is_active: bool
    is_low_stock: bool
    is_out_of_stock: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductListResponse(BaseModel):
    """Paginated list of products."""
    products: list[ProductResponse]
    total: int
    page: int
    page_size: int


class StockAdjustment(BaseModel):
    """Schema for manual stock adjustments."""
    quantity: int = Field(..., description="Positive to add, negative to deduct")
    reason: str = Field(..., min_length=1, max_length=200, examples=["Restock from supplier"])
