"""Product and inventory management service."""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product, Category
from app.schemas.product import ProductCreate, ProductUpdate


async def create_product(db: AsyncSession, product_data: ProductCreate) -> Product:
    """Create a new product.

    Raises:
        ValueError: If the SKU already exists.
    """
    existing = await db.execute(
        select(Product).where(Product.sku == product_data.sku)
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"Product with SKU '{product_data.sku}' already exists")

    product = Product(**product_data.model_dump())
    db.add(product)
    await db.flush()
    await db.refresh(product)
    return product


async def get_product_by_id(db: AsyncSession, product_id: int) -> Product | None:
    """Retrieve a product by its ID."""
    result = await db.execute(select(Product).where(Product.id == product_id))
    return result.scalar_one_or_none()


async def get_product_by_sku(db: AsyncSession, sku: str) -> Product | None:
    """Retrieve a product by its SKU."""
    result = await db.execute(select(Product).where(Product.sku == sku))
    return result.scalar_one_or_none()


async def list_products(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    category: Category | None = None,
    search: str | None = None,
    in_stock_only: bool = False,
    active_only: bool = True,
) -> tuple[list[Product], int]:
    """List products with filtering and pagination.

    Args:
        page: Page number (1-indexed).
        page_size: Number of items per page.
        category: Filter by product category.
        search: Search by product name (partial match).
        in_stock_only: Only return products with stock > 0.
        active_only: Only return active products.

    Returns:
        Tuple of (list of products, total count).
    """
    offset = (page - 1) * page_size
    query = select(Product)
    count_query = select(func.count(Product.id))

    # Apply filters
    if active_only:
        query = query.where(Product.is_active == True)
        count_query = count_query.where(Product.is_active == True)

    if category:
        query = query.where(Product.category == category)
        count_query = count_query.where(Product.category == category)

    if search:
        search_filter = Product.name.ilike(f"%{search}%")
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if in_stock_only:
        query = query.where(Product.stock_quantity > 0)
        count_query = count_query.where(Product.stock_quantity > 0)

    # Get total count
    count_result = await db.execute(count_query)
    total = count_result.scalar()

    # Get paginated results
    result = await db.execute(
        query.order_by(Product.name.asc()).offset(offset).limit(page_size)
    )
    products = list(result.scalars().all())

    return products, total


async def update_product(
    db: AsyncSession, product_id: int, product_data: ProductUpdate
) -> Product | None:
    """Update an existing product.

    Returns:
        Updated Product, or None if not found.
    """
    product = await get_product_by_id(db, product_id)
    if product is None:
        return None

    update_data = product_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    await db.flush()
    await db.refresh(product)
    return product


async def adjust_stock(
    db: AsyncSession, product_id: int, quantity: int
) -> Product | None:
    """Adjust stock quantity for a product.

    Args:
        product_id: The product to adjust.
        quantity: Positive to add stock, negative to deduct.

    Returns:
        Updated Product, or None if not found.

    Raises:
        ValueError: If the adjustment would result in negative stock.
    """
    product = await get_product_by_id(db, product_id)
    if product is None:
        return None

    new_quantity = product.stock_quantity + quantity
    if new_quantity < 0:
        raise ValueError(
            f"Insufficient stock for '{product.name}'. "
            f"Available: {product.stock_quantity}, Requested deduction: {abs(quantity)}"
        )

    product.stock_quantity = new_quantity
    await db.flush()
    await db.refresh(product)
    return product


async def delete_product(db: AsyncSession, product_id: int) -> bool:
    """Soft-delete a product by deactivating it.

    Returns:
        True if product was deactivated, False if not found.
    """
    product = await get_product_by_id(db, product_id)
    if product is None:
        return False

    product.is_active = False
    await db.flush()
    return True
