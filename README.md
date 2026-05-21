# ⚡ FastPOS — Cloud-Based Point of Sale System

<div align="center">

![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Integrated-6772E5?logo=stripe&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker&logoColor=white)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

**A full-stack, cloud-ready Point of Sale system built with FastAPI and a modern React + Vite cashier interface.**

[Features](#-features) · [Architecture](#-architecture) · [Quick Start](#-quick-start) · [API Docs](#-api-documentation) · [Deployment](#-deployment)

</div>

---

## 🎯 Features

### Core POS Operations
- 🛒 **Real-time Shopping Cart** — Add, remove, adjust quantities with live tax & discount calculation
- 📦 **Product Catalog CRUD** — Full inventory management with SKU tracking, categories, and stock alerts
- 💳 **Order Processing Workflow** — Complete checkout flow with stock validation and atomic transactions
- 🔄 **Transaction Refunds** — Admin-controlled refund system with automatic stock restoration

### Payments & Invoicing
- 💰 **Stripe Payment Gateway** — Secure checkout sessions with webhook handlers for payment confirmation
- 📄 **PDF Invoice Generation** — Professional, branded invoices using ReportLab, downloadable per transaction
- 📧 **Async Email Delivery** — Order confirmation emails via Celery task queues with SMTP integration

### Analytics & Reporting
- 📊 **Sales Analytics Dashboard** — Date-range filtering with revenue, transaction counts, and item metrics
- 🏆 **Product Performance Reports** — Top-selling products ranked by quantity and revenue
- 📅 **Daily Breakdown** — Granular day-by-day sales analysis
- 📥 **Dynamic Data Exports** — CSV and JSON export endpoints for sales and product data

### Security & Auth
- 🔐 **JWT Authentication** — Access + refresh token flow with automatic silent renewal
- 👥 **Role-Based Access Control** — Admin and Cashier roles with granular endpoint permissions
- 🔒 **Bcrypt Password Hashing** — Industry-standard password security

### DevOps & Infrastructure
- 🐳 **Docker Containerized** — Multi-stage Dockerfile with Docker Compose (FastAPI + PostgreSQL + Redis + Celery)
- 🚀 **CI/CD Pipeline** — GitHub Actions workflow: lint → test → build → deploy to AWS EC2
- 🧪 **Pytest Test Suite** — Async test coverage for auth, products, transactions, and reports

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Browser)                          │
│            React + Vite SPA + CSS Glassmorphism              │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API (JSON)
┌────────────────────────▼────────────────────────────────────┐
│                   FastAPI Application                        │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐  │
│  │  Auth    │  │ Products │  │Transactions│  │ Reports  │  │
│  │ Routes   │  │  Routes  │  │  Routes    │  │  Routes  │  │
│  └────┬─────┘  └────┬─────┘  └─────┬──────┘  └────┬─────┘  │
│       │             │              │               │        │
│  ┌────▼─────────────▼──────────────▼───────────────▼─────┐  │
│  │              Service Layer (Business Logic)            │  │
│  └───────────────────────┬───────────────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────▼───────────────────────────────┐  │
│  │           SQLAlchemy Async ORM + Pydantic Schemas      │  │
│  └───────────────────────┬───────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼─────┐    ┌──────▼──────┐   ┌──────▼──────┐
    │ PostgreSQL│    │    Redis    │   │   Stripe    │
    │  (RDS)    │    │  (Celery)  │   │  (Payments) │
    └──────────┘    └────────────┘   └─────────────┘
```

---

## 📂 Project Structure

```text
POSPython/
├── app/                          # FastAPI Backend
│   ├── models/                   # SQLAlchemy ORM models
│   │   ├── user.py               # User model with RBAC
│   │   ├── product.py            # Product & Category models
│   │   └── transaction.py        # Transaction & line items
│   ├── routes/                   # API endpoint definitions
│   │   ├── auth.py               # Login, register, token refresh
│   │   ├── users.py              # User management (Admin)
│   │   ├── products.py           # Product CRUD + stock adjustments
│   │   ├── transactions.py       # Checkout, history, refunds, invoices
│   │   ├── reports.py            # Analytics + CSV/JSON exports
│   │   └── payments.py           # Stripe checkout sessions & webhooks
│   ├── schemas/                  # Pydantic validation schemas
│   ├── services/                 # Business logic layer
│   ├── tasks/                    # Celery async tasks
│   │   └── email_tasks.py        # Order confirmation emails
│   ├── utils/                    # Helpers & utilities
│   │   ├── security.py           # JWT + bcrypt
│   │   ├── dependencies.py       # Auth injection (get_current_user)
│   │   └── pdf_generator.py      # ReportLab PDF invoice generator
│   ├── config.py                 # Pydantic Settings (env vars)
│   ├── database.py               # Async engine & session factory
│   ├── main.py                   # App factory + lifespan + CORS
│   └── worker.py                 # Celery application instance
├── frontend/                     # Browser-based React Cashier Interface
│   ├── src/                      # React components, pages, context, and utils
│   ├── index.html                # React entry HTML
│   └── package.json              # Node dependencies (Vite, React, Lucide)
├── tests/                        # Pytest async test suite
│   ├── conftest.py               # Test fixtures & DB setup
│   ├── test_auth.py              # Authentication tests
│   ├── test_products.py          # Product CRUD tests
│   ├── test_transactions.py      # Checkout & refund tests
│   └── test_reports.py           # Reporting endpoint tests
├── Dockerfile                    # Multi-stage production build
├── docker-compose.yml            # Full stack (Web + DB + Redis + Worker)
├── .github/workflows/ci-cd.yml   # GitHub Actions pipeline
├── requirements.txt              # Python dependencies
├── .env.example                  # Environment variable template
├── .gitignore                    # Git exclusions
└── run.py                        # Local development entry point
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.12+
- Redis (for Celery — optional for basic usage)

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/POSPython.git
cd POSPython

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env with your values (works out of the box for local dev)

# 5. Run the application
python run.py
```

The app will be available at **http://localhost:8080**

**Default credentials:** `admin` / `admin123`

### With Docker

```bash
# Start the full stack
docker compose up --build -d

# View logs
docker compose logs -f web

# Stop everything
docker compose down
```

---

## 📖 API Documentation

Once the server is running, interactive API docs are available at:

| Documentation | URL |
|---|---|
| **Swagger UI** | http://localhost:8080/docs |
| **ReDoc** | http://localhost:8080/redoc |

### Key Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Authenticate and get JWT tokens |
| `POST` | `/api/v1/auth/register` | Register new user |
| `GET` | `/api/v1/products/` | List products (paginated, filterable) |
| `POST` | `/api/v1/products/` | Create product (Admin) |
| `POST` | `/api/v1/transactions/checkout` | Process cart checkout |
| `GET` | `/api/v1/transactions/{id}/invoice` | Download PDF invoice |
| `POST` | `/api/v1/transactions/{id}/refund` | Refund transaction (Admin) |
| `GET` | `/api/v1/reports/sales/summary` | Sales analytics (date range) |
| `GET` | `/api/v1/reports/export/csv` | Export sales data as CSV |
| `GET` | `/api/v1/reports/export/json` | Export sales data as JSON |
| `POST` | `/api/v1/payments/create-checkout-session` | Create Stripe session |
| `POST` | `/api/v1/payments/webhook` | Stripe webhook handler |

---

## 🧪 Testing

```bash
# Run the full test suite
pytest tests/ -v

# Run specific test modules
pytest tests/test_auth.py -v
pytest tests/test_transactions.py -v
```

---

## 🐳 Deployment

### Docker Compose (Production)

```bash
# Set production environment variables
export SECRET_KEY=$(openssl rand -hex 32)
export STRIPE_SECRET_KEY=sk_live_...

# Deploy
docker compose -f docker-compose.yml up -d
```

### AWS (EC2 + RDS + S3)

1. **EC2**: Launch an instance with Docker installed
2. **RDS**: Create a PostgreSQL instance, update `DATABASE_URL`
3. **ElastiCache**: Redis instance for Celery broker
4. **Configure**: Set environment variables in `.env` or EC2 user data
5. **Deploy**: Push to `main` — GitHub Actions handles the rest

### CI/CD Pipeline

The `.github/workflows/ci-cd.yml` pipeline:

1. ✅ **Lint** — flake8 syntax checks
2. ✅ **Test** — pytest suite execution
3. 🐳 **Build** — Docker image build & push to Docker Hub
4. 🚀 **Deploy** — SSH into EC2 and pull latest containers

**Required GitHub Secrets:**
- `DOCKER_USERNAME` / `DOCKER_PASSWORD`
- `EC2_HOST` / `EC2_USERNAME` / `EC2_SSH_KEY`

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.12, FastAPI, SQLAlchemy (async), Pydantic |
| **Database** | SQLite (dev) / PostgreSQL (prod) |
| **Auth** | JWT (python-jose), bcrypt |
| **Payments** | Stripe Checkout + Webhooks |
| **Task Queue** | Celery + Redis |
| **PDF** | ReportLab |
| **Frontend** | React 18, Vite, React Router, CSS3 (glassmorphism) |
| **Containerization** | Docker (Multi-stage build), Docker Compose |
| **CI/CD** | GitHub Actions |
| **Cloud** | AWS (EC2, RDS, S3) |

---

## 📄 License

This project is licensed under the MIT License.
