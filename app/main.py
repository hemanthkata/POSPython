"""FastPOS - Main Application Entry Point.

High-performance Point of Sale API built with FastAPI.
"""

from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import get_settings
from app.database import init_db, async_session_factory
from app.models.user import User, UserRole
from app.utils.security import hash_password
from app.routes import auth, users, products, transactions, reports, payments

from sqlalchemy import select

settings = get_settings()


async def seed_default_admin():
    """Create the default admin user if it doesn't already exist."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(User).where(User.username == settings.DEFAULT_ADMIN_USERNAME)
        )
        existing = result.scalar_one_or_none()

        if existing is None:
            admin = User(
                username=settings.DEFAULT_ADMIN_USERNAME,
                email=settings.DEFAULT_ADMIN_EMAIL,
                hashed_password=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
                full_name="System Administrator",
                role=UserRole.ADMIN,
                is_active=True,
            )
            session.add(admin)
            await session.commit()
            print(f"[+] Default admin user '{settings.DEFAULT_ADMIN_USERNAME}' created.")
        else:
            print(f"[i] Admin user '{settings.DEFAULT_ADMIN_USERNAME}' already exists.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle management."""
    # -- Startup --
    print("[*] Starting FastPOS Application...")
    await init_db()
    print("[+] Database tables created/verified.")
    await seed_default_admin()
    print(f"[+] FastPOS v{settings.APP_VERSION} is ready!")
    print(f"[>] API Docs: http://localhost:{settings.APP_PORT}/docs")
    print(f"[>] ReDoc:    http://localhost:{settings.APP_PORT}/redoc")

    yield

    # -- Shutdown --
    print("[*] Shutting down FastPOS...")


# ── Application Factory ──────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "**FastPOS** is a lightweight, high-performance Point of Sale API "
        "designed for small-to-medium retail operations.\n\n"
        "## Features\n"
        "- 🔐 JWT-based authentication with Role-Based Access Control\n"
        "- 📦 Full inventory management with stock tracking\n"
        "- 🛒 Cart-based checkout with tax and discount calculation\n"
        "- 📊 Sales reporting and analytics\n"
        "- 🔄 Transaction refunds with automatic stock restoration\n\n"
        "## Roles\n"
        "- **Admin**: Full access to all endpoints\n"
        "- **Cashier**: Sales operations and product viewing\n\n"
        "## Default Credentials\n"
        "- Username: `admin` / Password: `admin123`"
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "Authentication", "description": "Login, registration, and token management"},
        {"name": "User Management", "description": "User CRUD operations (Admin only)"},
        {"name": "Inventory Management", "description": "Product and stock management"},
        {"name": "Sales & Transactions", "description": "Checkout, transaction history, and refunds"},
        {"name": "Reporting & Analytics", "description": "Sales reports and inventory insights"},
    ],
)

# ── CORS Middleware ───────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Routers ─────────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(products.router, prefix=API_PREFIX)
app.include_router(transactions.router, prefix=API_PREFIX)
app.include_router(reports.router, prefix=API_PREFIX)
app.include_router(payments.router, prefix=API_PREFIX)


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

@app.get("/health", tags=["System"])
async def health_check():
    """System health check endpoint."""
    return {"status": "healthy"}

@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    """Serve the React SPA and static assets."""
    # Do not intercept API or docs routes
    if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not Found")
        
    file_path = FRONTEND_DIR / full_path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
        
    # SPA routing fallback
    return FileResponse(FRONTEND_DIR / "index.html")
