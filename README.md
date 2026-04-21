# FastPOS — Developer Documentation

Welcome to the FastPOS codebase! This document provides a clear, step-by-step breakdown of how the entire system works. It explains what every folder contains, what every file does, and how data travels from the screen all the way to the database.

---

## 1. High-Level Architecture

FastPOS is a **Full-Stack Application** divided into two main layers:

1.  **Backend (FastAPI)**: Written in Python. It handles database connections, business logic, security (roles & passwords), and serves the data through API endpoints.
2.  **Frontend (Vanilla JavaScript)**: Written in HTML, CSS, and JS. It runs in the user's browser, handles the visual interface (buttons, tables, carts), and asks the backend for data.

Because they are cleanly separated, they communicate entirely over **JSON API calls**. (e.g., The frontend says "Give me the products", and the backend replies with a JSON list of products).

---

## 2. Directory Structure

Here is a bird's-eye view of your project:

```text
d:\New project\
├── app/                  <-- Everything related to the Python Server
│   ├── models/           <-- Database schemas (SQLAlchemy tables)
│   ├── routes/           <-- API endpoint definitions (The URLs)
│   ├── schemas/          <-- Data validation rules (Pydantic formats)
│   ├── services/         <-- The core business logic and math
│   ├── utils/            <-- Helper tools (Security, JWT, Passwords)
│   ├── config.py         <-- Environment variables mapping
│   ├── database.py       <-- Database connection logic
│   └── main.py           <-- The engine that starts the server
├── frontend/             <-- Everything the User Sees
│   ├── index.html        <-- The UI structure and Modals
│   ├── styles.css        <-- The Dark-mode glassmorphism design
│   └── app.js            <-- The magic that makes buttons click and data load
├── pos_database.db       <-- Your actual SQLite Database
├── run.py                <-- The script you run to start everything
└── requirements.txt      <-- The Python packages to install
```

---

## 3. The Backend (`app/`) Breakdown

### A. The Database Layer (`models/` & `database.py`)
This is where the structure of your permanent data lives.
*   **`database.py`**: Uses `sqlalchemy` and `aiosqlite` to connect to `pos_database.db` asynchronously (meaning it doesn't freeze the app while saving data).
*   **`models/user.py`**: Defines the `users` table. Saves username, hashed password, and role (`admin` or `cashier`).
*   **`models/product.py`**: Defines the `products` table. Tracks SKU, price, costs, categories, and **stock quantity**.
*   **`models/transaction.py`**: Defines two tables: `transactions` (the checkout receipt level) and `transaction_items` (the individual items bought inside that receipt).

### B. The Validation Layer (`schemas/`)
Before data is saved to the database, or before it is sent to the frontend, it passes through **Pydantic Schemas**. These ensure bad data is blocked immediately.
*   **`schemas/user.py`**: Ensures passwords are >= 6 chars, and emails look like emails.
*   **`schemas/product.py`**: Ensures prices are greater than $0, and SKU strings aren't empty.
*   **`schemas/transaction.py`**: Structures exactly how a checkout payload must look (a list of product IDs and quantities).

### C. The API Definition Layer (`routes/`)
These are the internet URLs that your frontend connects to. If a user hits `POST /users/`, it arrives here.
*   **`routes/auth.py`**: Handles `/login`. Validates passwords and generates a secure JWT token that the frontend must use for all future requests.
*   **`routes/products.py`**: Contains `GET`, `POST`, `PUT`, `DELETE` endpoints for inventory. Protected by `Depends(get_current_admin)`.
*   **`routes/transactions.py`**: Contains the critical `POST /checkout` endpoint.
*   **`routes/users.py`**: Handles user management and profile data.
*   **`routes/reports.py`**: Gathers math-heavy analytics for the dashboard.

### D. The Brains (`services/`)
Routes *do not* talk to the database directly. They pass the request to **Services**. Services execute business logic securely.
*   **`services/transaction_service.py`**: The most complex logic. When you trigger a `checkout`, this file loops through the cart. It checks stock, calculates taxes, applies discounts, safely deducts stock, and creates the transaction. It uses **database commits**, meaning if one step crashes, the entire checkout reverses automatically so you don't lose stock tracking!
*   **`services/report_service.py`**: Groups data by dates. Calculates the daily revenue, most sold items, and current inventory monetary value.

### E. Security (`utils/`)
*   **`utils/security.py`**: Hashes passwords using `bcrypt`. A hacker looking at your database will only see gibberish strings, never real passwords. Also handles creating JWT (JSON Web Tokens) for sessions.
*   **`utils/dependencies.py`**: This acts as a bouncer. Before allowing access to a route, it intercepts the JWT token in the web headers, verifies it hasn't expired, and proves who the user is. (It also prevents a `cashier` from viewing the `/reports` route!).

---

## 4. The Frontend (`frontend/`) Breakdown

### A. The Skeleton (`index.html`)
FastPOS is a **Single Page Application (SPA)**. There is only one HTML file. 
*   Instead of loading a new web page every time you click a tab, the HTML stores every section (Dashboard, POS, Products) inside `<div class="page hidden">` tags.
*   It also stores all modals (Alerts, Add User overlay) at the bottom.

### B. The Paint (`styles.css`)
*   Contains a defined **Design System** utilizing CSS custom properties (variables) at the top for colors (ex: `var(--accent-400)`). 
*   Implements **Glassmorphism** heavily on the login card (`backdrop-filter`) and smooth grid layouts for the POS items.
*   The `.hidden { display: none !important; }` rule is what powers the logic to instantly hide screens the user shouldn't see.

### C. The Muscles (`app.js`)
At ~900 lines of code, this is what makes your dashboard alive. Let's break down its internal sections:
1.  **State Management**: `let authToken`, `let cart`, `let currentUser` store temporary browser session data.
2.  **`apiJSON()` & `tryRefreshToken()`**: A custom helper. Every time JS talks to FastAPI, it sends the `authToken` header securely. If the token expired after 30 minutes, it automatically calls the backend secretly to get a new token without logging you out!
3.  **`navigateTo(page)`**: The core router. It finds all `div.page` tags, adds `.hidden` to them all, and then removes `.hidden` ONLY from the active one.
4.  **`addToCart()` & `renderCart()`**: Stores product IDs in memory. Recalculates subtotal * tax - discount dynamically to update the screen before hitting the database.
5.  **`toast(message, type)`**: Creates small notification bubbles in the bottom corner gracefully.

---

## 5. Follow the Data (Example: Checking Out)

To understand how it connects, imagine the cashier processes a checkout. Here is the exact path:

1.  **Frontend (app.js)**: Cashier clicks `+` next to an iPhone. The JS pushes the item to the `cart` array and updates the total calculation.
2.  **Frontend (app.js)**: Cashier clicks `Checkout`. `processCheckout()` takes the cart array and `fetch()` POSTs it to `http://localhost:8080/api/v1/transactions/checkout`. 
3.  **Backend (routes/transactions.py)**: Receives the route hit. First checks security: `get_current_user` intercepts the JWT token and verifies it. Then passes the cart to the service.
4.  **Backend (services/transaction_service.py)**:
    *   Finds the iPhone in the DB: Is `stock_quantity > 0`? Yes.
    *   Deducts iPhone by `1` in memory.
    *   Creates a `Transaction` row.
    *   Creates a `TransactionItem` row.
    *   Runs `db.commit()` to permanently save this to the hard drive.
5.  **Backend (schemas/transaction.py)**: Structures the success data into a beautiful "Receipt" format and returns it as a JSON string to the frontend.
6.  **Frontend (app.js)**: Receives the receipt JSON, wipes the local `cart`, calls `loadPosProducts()` to refresh the now-lower stock count from the server, and triggers `showReceipt()` to open the modal!
