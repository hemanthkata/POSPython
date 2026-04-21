"""Product and Category models for inventory management."""

import enum
from datetime import datetime

from sqlalchemy import String, Float, Integer, Enum, DateTime, Text, func, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Category(str, enum.Enum):
    """Product categories."""
    FOOD = "food"
    BEVERAGE = "beverage"
    ELECTRONICS = "electronics"
    CLOTHING = "clothing"
    GROCERY = "grocery"
    HEALTH = "health"
    STATIONERY = "stationery"
    OTHER = "other"


class Product(Base):
    """Product model for inventory tracking."""

    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[Category] = mapped_column(Enum(Category), default=Category.OTHER, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    cost_price: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    @property
    def is_low_stock(self) -> bool:
        """Check if product stock is below threshold."""
        return self.stock_quantity <= self.low_stock_threshold

    @property
    def is_out_of_stock(self) -> bool:
        """Check if product is out of stock."""
        return self.stock_quantity <= 0

    def __repr__(self) -> str:
        return f"<Product(id={self.id}, name='{self.name}', sku='{self.sku}', stock={self.stock_quantity})>"
