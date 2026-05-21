/* ═══════════════════════════════════════════════════════════════════════════
   FastPOS — Frontend Application Logic
   Connects to FastAPI backend at configurable API_BASE
   ═══════════════════════════════════════════════════════════════════════════ */

const API_BASE = 'http://localhost:8080/api/v1';

// ── State ──────────────────────────────────────────────────────────────────
let authToken = localStorage.getItem('fastpos_token') || null;
let refreshToken = localStorage.getItem('fastpos_refresh') || null;
let currentUser = null;
let cart = [];
let allPosProducts = [];
let currentViewingTransactionId = null;

// ── Category Icons ─────────────────────────────────────────────────────────
const categoryIcons = {
    food: '\uD83C\uDF54', beverage: '\u2615', electronics: '\uD83D\uDCF1',
    clothing: '\uD83D\uDC55', grocery: '\uD83D\uDED2', health: '\uD83D\uDC8A',
    stationery: '\u270F\uFE0F', other: '\uD83D\uDCE6',
};

// ═══════════════════════════════════════════════════════════════════════════
//  API HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function api(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

    if (response.status === 401 && refreshToken) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
            headers['Authorization'] = `Bearer ${authToken}`;
            return fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        }
        logout();
        return response;
    }

    return response;
}

async function apiJSON(endpoint, options = {}) {
    const res = await api(endpoint, options);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(err.detail || 'Something went wrong');
    }
    return res.json();
}

async function tryRefreshToken() {
    try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (res.ok) {
            const data = await res.json();
            authToken = data.access_token;
            refreshToken = data.refresh_token;
            localStorage.setItem('fastpos_token', authToken);
            localStorage.setItem('fastpos_refresh', refreshToken);
            return true;
        }
    } catch (e) { /* fail silently */ }
    return false;
}

// ═══════════════════════════════════════════════════════════════════════════
//  AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Signing in...';

    try {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData,
        });

        if (!res.ok) throw new Error('Invalid username or password');

        const data = await res.json();
        authToken = data.access_token;
        refreshToken = data.refresh_token;
        localStorage.setItem('fastpos_token', authToken);
        localStorage.setItem('fastpos_refresh', refreshToken);

        await loadCurrentUser();
        showApp();
        toast('Welcome back!', 'success');
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Sign In';
    }
});

async function loadCurrentUser() {
    currentUser = await apiJSON('/users/me');
    document.getElementById('user-display-name').textContent = currentUser.full_name;
    document.getElementById('user-display-role').textContent = currentUser.role;
    document.getElementById('user-avatar').textContent = currentUser.full_name.charAt(0).toUpperCase();

    const isAdmin = currentUser.role === 'admin';
    document.getElementById('admin-section-label').style.display = isAdmin ? '' : 'none';
    document.getElementById('nav-reports').style.display = isAdmin ? '' : 'none';
    document.getElementById('nav-users').style.display = isAdmin ? '' : 'none';
    document.getElementById('add-product-btn').style.display = isAdmin ? '' : 'none';
}

function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    navigateTo('dashboard');
}

function logout() {
    authToken = null;
    refreshToken = null;
    currentUser = null;
    localStorage.removeItem('fastpos_token');
    localStorage.removeItem('fastpos_refresh');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('login-password').value = '';
}

// ═══════════════════════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════

function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    document.getElementById(`page-${page}`)?.classList.remove('hidden');
    document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');

    switch (page) {
        case 'dashboard': loadDashboard(); break;
        case 'pos': loadPosProducts(); break;
        case 'products': loadProducts(); break;
        case 'transactions': loadTransactions(); break;
        case 'reports': initReportDates(); break;
        case 'users': loadUsers(); break;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

async function loadDashboard() {
    try {
        const inventory = await apiJSON('/reports/inventory');

        document.getElementById('dashboard-stats').innerHTML = `
            <div class="stat-card">
                <div class="stat-icon blue">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                </div>
                <div class="stat-info">
                    <div class="stat-value">${inventory.active_products}</div>
                    <div class="stat-label">Active Products</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <div class="stat-info">
                    <div class="stat-value">$${inventory.total_inventory_value.toLocaleString()}</div>
                    <div class="stat-label">Inventory Value</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon amber">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <div class="stat-info">
                    <div class="stat-value">${inventory.low_stock_count}</div>
                    <div class="stat-label">Low Stock Items</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon rose">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </div>
                <div class="stat-info">
                    <div class="stat-value">${inventory.out_of_stock_count}</div>
                    <div class="stat-label">Out of Stock</div>
                </div>
            </div>
        `;

        document.getElementById('inventory-health-content').innerHTML = `
            <div style="display:grid;gap:0.75rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="text-muted" style="font-size:0.88rem;">Total Products</span>
                    <span style="font-weight:600;">${inventory.total_products}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="text-muted" style="font-size:0.88rem;">Active</span>
                    <span class="badge badge-success">${inventory.active_products}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="text-muted" style="font-size:0.88rem;">Low Stock</span>
                    <span class="badge badge-warning">${inventory.low_stock_count}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="text-muted" style="font-size:0.88rem;">Out of Stock</span>
                    <span class="badge badge-danger">${inventory.out_of_stock_count}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding-top:0.5rem;border-top:1px solid var(--border-subtle);">
                    <span class="text-muted" style="font-size:0.88rem;">Inventory Value</span>
                    <span style="font-weight:700;color:var(--accent-400);">$${inventory.total_inventory_value.toLocaleString()}</span>
                </div>
            </div>
        `;

        // Load daily sales for admin
        if (currentUser?.role === 'admin') {
            try {
                const today = new Date().toISOString().split('T')[0];
                const daily = await apiJSON(`/reports/sales/daily?target_date=${today}`);
                document.getElementById('daily-stats-content').innerHTML = `
                    <div style="display:grid;gap:0.75rem;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span class="text-muted" style="font-size:0.88rem;">Revenue</span>
                            <span style="font-weight:700;color:var(--accent-400);font-size:1.2rem;">$${daily.total_revenue.toFixed(2)}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span class="text-muted" style="font-size:0.88rem;">Transactions</span>
                            <span style="font-weight:600;">${daily.total_transactions}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span class="text-muted" style="font-size:0.88rem;">Items Sold</span>
                            <span style="font-weight:600;">${daily.total_items_sold}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span class="text-muted" style="font-size:0.88rem;">Avg. Transaction</span>
                            <span style="font-weight:600;">$${daily.average_transaction_value.toFixed(2)}</span>
                        </div>
                    </div>
                `;
            } catch {
                document.getElementById('daily-stats-content').innerHTML = '<p class="text-muted">No sales data yet today</p>';
            }
        } else {
            document.getElementById('daily-stats-content').innerHTML = '<p class="text-muted">Admin access required for sales data</p>';
        }
    } catch (e) {
        toast('Failed to load dashboard: ' + e.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  POS TERMINAL
// ═══════════════════════════════════════════════════════════════════════════

async function loadPosProducts() {
    try {
        const data = await apiJSON('/products/?page_size=100&in_stock_only=false');
        allPosProducts = data.products;
        renderPosProducts(allPosProducts);
    } catch (e) {
        toast('Failed to load products: ' + e.message, 'error');
    }
}

function filterPosProducts() {
    const search = document.getElementById('pos-search').value.toLowerCase();
    const category = document.getElementById('pos-category').value;
    let filtered = allPosProducts;

    if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search));
    if (category) filtered = filtered.filter(p => p.category === category);
    renderPosProducts(filtered);
}

function renderPosProducts(products) {
    const grid = document.getElementById('pos-product-grid');
    if (products.length === 0) {
        grid.innerHTML = '<p class="text-muted text-center" style="grid-column:1/-1;padding:3rem;">No products found</p>';
        return;
    }
    grid.innerHTML = products.map(p => `
        <div class="product-tile ${p.is_out_of_stock ? 'out-of-stock' : ''}"
             onclick="addToCart(${p.id}, '${p.name.replace(/'/g, "\\'")}', ${p.price}, ${p.stock_quantity})">
            <span class="product-emoji">${categoryIcons[p.category] || '\uD83D\uDCE6'}</span>
            <div class="product-name" title="${p.name}">${p.name}</div>
            <div class="product-price">$${p.price.toFixed(2)}</div>
            <div class="product-stock">${p.is_out_of_stock ? 'Out of stock' : `${p.stock_quantity} in stock`}</div>
        </div>
    `).join('');
}

function addToCart(productId, name, price, maxStock) {
    const existing = cart.find(item => item.product_id === productId);
    if (existing) {
        if (existing.quantity >= maxStock) {
            toast(`Max stock for "${name}" reached`, 'warning');
            return;
        }
        existing.quantity++;
    } else {
        cart.push({ product_id: productId, name, price, quantity: 1, max_stock: maxStock });
    }
    renderCart();
    toast(`${name} added`, 'success');
}

function updateCartQty(productId, delta) {
    const item = cart.find(i => i.product_id === productId);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.product_id !== productId);
    } else if (item.quantity > item.max_stock) {
        item.quantity = item.max_stock;
        toast('Max stock reached', 'warning');
    }
    renderCart();
}

function removeFromCart(productId) {
    cart = cart.filter(i => i.product_id !== productId);
    renderCart();
}

function clearCart() {
    cart = [];
    renderCart();
}

function renderCart() {
    const container = document.getElementById('cart-items');
    const summary = document.getElementById('cart-summary');
    const countEl = document.getElementById('cart-count');

    const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
    countEl.textContent = totalItems;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="cart-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                <span>Cart is empty</span>
                <span style="font-size:0.78rem">Click products to add</span>
            </div>
        `;
        summary.style.display = 'none';
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">$${item.price.toFixed(2)} each</div>
            </div>
            <div class="cart-item-qty">
                <button onclick="updateCartQty(${item.product_id}, -1)">-</button>
                <span>${item.quantity}</span>
                <button onclick="updateCartQty(${item.product_id}, 1)">+</button>
            </div>
            <div class="cart-item-total">$${(item.price * item.quantity).toFixed(2)}</div>
            <button class="cart-item-remove" onclick="removeFromCart(${item.product_id})">&times;</button>
        </div>
    `).join('');

    summary.style.display = '';
    updateCartTotals();
}

function updateCartTotals() {
    const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const discountPct = parseFloat(document.getElementById('cart-discount').value) || 0;
    const discountAmt = subtotal * (discountPct / 100);
    const taxable = subtotal - discountAmt;
    const taxRate = 10; // matches backend default
    const taxAmt = taxable * (taxRate / 100);
    const total = taxable + taxAmt;

    document.getElementById('cart-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('cart-discount-amount').textContent = `-$${discountAmt.toFixed(2)}`;
    document.getElementById('cart-tax').textContent = `$${taxAmt.toFixed(2)}`;
    document.getElementById('cart-total').textContent = `$${total.toFixed(2)}`;
    document.getElementById('tax-rate-display').textContent = taxRate;
}

async function processCheckout() {
    if (cart.length === 0) return;
    const btn = document.getElementById('checkout-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';

    try {
        const payload = {
            items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
            payment_method: document.getElementById('payment-method').value,
            discount_percent: parseFloat(document.getElementById('cart-discount').value) || 0,
        };

        const receipt = await apiJSON('/transactions/checkout', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        showReceipt(receipt);
        cart = [];
        renderCart();
        loadPosProducts(); // refresh stock
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Checkout';
    }
}

function showReceipt(receipt) {
    const content = document.getElementById('receipt-content');
    content.innerHTML = `
        <div class="receipt-checkmark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3>Payment Successful!</h3>
        <div class="receipt-id">ID: ${receipt.transaction_id}</div>
        <div class="receipt-items">
            <table>
                <tbody>
                    ${receipt.items.map(i => `
                        <tr>
                            <td>${i.product_name} x${i.quantity}</td>
                            <td class="text-right">$${i.line_total.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <hr class="receipt-divider">
        <div style="display:grid;gap:0.4rem;text-align:left;">
            <div style="display:flex;justify-content:space-between;font-size:0.88rem;"><span class="text-muted">Subtotal</span><span>$${receipt.subtotal.toFixed(2)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:0.88rem;"><span class="text-muted">Discount</span><span>-$${receipt.discount_amount.toFixed(2)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:0.88rem;"><span class="text-muted">Tax</span><span>$${receipt.tax_amount.toFixed(2)}</span></div>
            <hr class="receipt-divider">
            <div style="display:flex;justify-content:space-between;font-size:1.1rem;font-weight:700;"><span>Total</span><span style="color:var(--accent-400);">$${receipt.total_amount.toFixed(2)}</span></div>
        </div>
        <div style="margin-top:1rem;font-size:0.8rem;color:var(--text-muted);">
            ${receipt.payment_method.toUpperCase()} | Cashier: ${receipt.cashier} | ${new Date(receipt.timestamp).toLocaleString()}
        </div>
    `;
    openModal('receipt-modal');
}

// ═══════════════════════════════════════════════════════════════════════════
//  PRODUCTS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

let productsPage = 1;

async function loadProducts(page = 1) {
    productsPage = page;
    const search = document.getElementById('product-search')?.value || '';
    const category = document.getElementById('product-category-filter')?.value || '';
    let url = `/products/?page=${page}&page_size=15`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (category) url += `&category=${category}`;

    try {
        const data = await apiJSON(url);
        renderProductsTable(data);
    } catch (e) {
        toast('Failed to load products', 'error');
    }
}

function renderProductsTable(data) {
    const tbody = document.getElementById('products-table-body');
    const isAdmin = currentUser?.role === 'admin';

    if (data.products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:2rem;">No products found</td></tr>';
        document.getElementById('products-pagination').innerHTML = '';
        return;
    }

    tbody.innerHTML = data.products.map(p => `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td><code style="font-size:0.8rem;color:var(--text-muted);">${p.sku}</code></td>
            <td><span class="badge badge-info">${p.category}</span></td>
            <td style="font-weight:600;">$${p.price.toFixed(2)}</td>
            <td>
                <span class="${p.is_out_of_stock ? 'text-danger' : p.is_low_stock ? 'text-warning' : 'text-success'}" style="font-weight:600;">
                    ${p.stock_quantity}
                </span>
            </td>
            <td><span class="badge ${p.is_active ? 'badge-success' : 'badge-neutral'}">${p.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                ${isAdmin ? `
                    <button class="btn btn-ghost btn-sm" onclick="editProduct(${p.id})">Edit</button>
                    <button class="btn btn-ghost btn-sm text-danger" onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')">Delete</button>
                ` : '-'}
            </td>
        </tr>
    `).join('');

    renderPagination('products-pagination', data, loadProducts);
}

function openProductModal(product = null) {
    document.getElementById('product-modal-title').textContent = product ? 'Edit Product' : 'Add Product';
    document.getElementById('product-edit-id').value = product?.id || '';
    document.getElementById('product-name').value = product?.name || '';
    document.getElementById('product-sku').value = product?.sku || '';
    document.getElementById('product-sku').disabled = !!product;
    document.getElementById('product-description').value = product?.description || '';
    document.getElementById('product-category-input').value = product?.category || 'other';
    document.getElementById('product-price').value = product?.price || '';
    document.getElementById('product-cost').value = product?.cost_price || '';
    document.getElementById('product-stock').value = product?.stock_quantity ?? '';
    document.getElementById('product-threshold').value = product?.low_stock_threshold ?? 10;
    openModal('product-modal');
}

async function editProduct(id) {
    try {
        const product = await apiJSON(`/products/${id}`);
        openProductModal(product);
    } catch (e) {
        toast('Failed to load product', 'error');
    }
}

document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('product-edit-id').value;
    const payload = {
        name: document.getElementById('product-name').value,
        description: document.getElementById('product-description').value || null,
        category: document.getElementById('product-category-input').value,
        price: parseFloat(document.getElementById('product-price').value),
        cost_price: parseFloat(document.getElementById('product-cost').value) || 0,
        stock_quantity: parseInt(document.getElementById('product-stock').value) || 0,
        low_stock_threshold: parseInt(document.getElementById('product-threshold').value) || 10,
    };

    try {
        if (editId) {
            await apiJSON(`/products/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
            toast('Product updated', 'success');
        } else {
            payload.sku = document.getElementById('product-sku').value;
            await apiJSON('/products/', { method: 'POST', body: JSON.stringify(payload) });
            toast('Product created', 'success');
        }
        closeModal('product-modal');
        loadProducts(productsPage);
    } catch (e) {
        toast(e.message, 'error');
    }
});

async function deleteProduct(id, name) {
    if (!confirm(`Deactivate "${name}"? This will hide it from the POS.`)) return;
    try {
        await apiJSON(`/products/${id}`, { method: 'DELETE' });
        toast(`${name} deactivated`, 'success');
        loadProducts(productsPage);
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════

let transactionsPage = 1;

async function loadTransactions(page = 1) {
    transactionsPage = page;
    try {
        const data = await apiJSON(`/transactions/?page=${page}&page_size=15`);
        renderTransactionsTable(data);
    } catch (e) {
        toast('Failed to load transactions', 'error');
    }
}

function renderTransactionsTable(data) {
    const tbody = document.getElementById('transactions-table-body');
    const isAdmin = currentUser?.role === 'admin';

    if (data.transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:2rem;">No transactions yet</td></tr>';
        return;
    }

    tbody.innerHTML = data.transactions.map(t => {
        const statusClass = { completed: 'badge-success', refunded: 'badge-warning', pending: 'badge-info', cancelled: 'badge-danger' };
        const itemCount = t.items.reduce((sum, i) => sum + i.quantity, 0);
        return `
            <tr>
                <td><code style="font-size:0.78rem;">${t.transaction_id.substring(0, 8)}...</code></td>
                <td>${new Date(t.created_at).toLocaleDateString()}</td>
                <td>${itemCount} items</td>
                <td style="font-weight:600;">$${t.total_amount.toFixed(2)}</td>
                <td><span class="badge badge-neutral">${t.payment_method}</span></td>
                <td><span class="badge ${statusClass[t.status] || 'badge-neutral'}">${t.status}</span></td>
                <td>
                    <button class="btn btn-ghost btn-sm" onclick="viewTransaction('${t.transaction_id}')">View</button>
                    ${isAdmin && t.status === 'completed' ? `<button class="btn btn-ghost btn-sm text-danger" onclick="refundTransaction('${t.transaction_id}')">Refund</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');

    renderPagination('transactions-pagination', data, loadTransactions);
}

async function viewTransaction(txId) {
    try {
        const t = await apiJSON(`/transactions/${txId}`);
        const content = document.getElementById('transaction-detail-content');
        content.innerHTML = `
            <div style="display:grid;gap:0.75rem;margin-bottom:1.25rem;">
                <div style="display:flex;justify-content:space-between;"><span class="text-muted">Transaction ID</span><code style="font-size:0.8rem;">${t.transaction_id}</code></div>
                <div style="display:flex;justify-content:space-between;"><span class="text-muted">Status</span><span class="badge ${t.status === 'completed' ? 'badge-success' : 'badge-warning'}">${t.status}</span></div>
                <div style="display:flex;justify-content:space-between;"><span class="text-muted">Payment</span><span>${t.payment_method}</span></div>
                <div style="display:flex;justify-content:space-between;"><span class="text-muted">Date</span><span>${new Date(t.created_at).toLocaleString()}</span></div>
            </div>
            <h4 style="font-size:0.9rem;margin-bottom:0.75rem;">Line Items</h4>
            <table>
                <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                <tbody>
                    ${t.items.map(i => `<tr><td>${i.product_name}</td><td>${i.quantity}</td><td>$${i.unit_price.toFixed(2)}</td><td style="font-weight:600;">$${i.line_total.toFixed(2)}</td></tr>`).join('')}
                </tbody>
            </table>
            <hr class="receipt-divider">
            <div style="display:grid;gap:0.4rem;">
                <div style="display:flex;justify-content:space-between;font-size:0.88rem;"><span class="text-muted">Subtotal</span><span>$${t.subtotal.toFixed(2)}</span></div>
                <div style="display:flex;justify-content:space-between;font-size:0.88rem;"><span class="text-muted">Discount</span><span>-$${t.discount_amount.toFixed(2)}</span></div>
                <div style="display:flex;justify-content:space-between;font-size:0.88rem;"><span class="text-muted">Tax</span><span>$${t.tax_amount.toFixed(2)}</span></div>
                <div style="display:flex;justify-content:space-between;font-size:1.1rem;font-weight:700;padding-top:0.5rem;border-top:1px solid var(--border-subtle);"><span>Total</span><span style="color:var(--accent-400);">$${t.total_amount.toFixed(2)}</span></div>
            </div>
        `;
        currentViewingTransactionId = t.transaction_id;
        document.getElementById('download-invoice-btn').style.display = '';
        openModal('transaction-detail-modal');
    } catch (e) {
        toast('Failed to load transaction', 'error');
    }
}

async function refundTransaction(txId) {
    if (!confirm('Refund this transaction? Stock will be restored.')) return;
    try {
        await apiJSON(`/transactions/${txId}/refund`, { method: 'POST' });
        toast('Transaction refunded', 'success');
        loadTransactions(transactionsPage);
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  REPORTS
// ═══════════════════════════════════════════════════════════════════════════

function initReportDates() {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    document.getElementById('report-start-date').value = weekAgo;
    document.getElementById('report-end-date').value = today;
}

async function loadSalesReport() {
    const startDate = document.getElementById('report-start-date').value;
    const endDate = document.getElementById('report-end-date').value;
    if (!startDate || !endDate) { toast('Select date range', 'warning'); return; }

    try {
        const data = await apiJSON(`/reports/sales/summary?start_date=${startDate}&end_date=${endDate}`);

        document.getElementById('report-stats').innerHTML = `
            <div class="stat-card">
                <div class="stat-icon green">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <div class="stat-info">
                    <div class="stat-value">$${data.total_revenue.toFixed(2)}</div>
                    <div class="stat-label">Total Revenue</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon blue">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div class="stat-info">
                    <div class="stat-value">${data.total_transactions}</div>
                    <div class="stat-label">Transactions</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon amber">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                </div>
                <div class="stat-info">
                    <div class="stat-value">${data.total_items_sold}</div>
                    <div class="stat-label">Items Sold</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon rose">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                </div>
                <div class="stat-info">
                    <div class="stat-value">$${data.average_daily_revenue.toFixed(2)}</div>
                    <div class="stat-label">Avg. Daily Revenue</div>
                </div>
            </div>
        `;

        // Top Products
        if (data.top_products.length > 0) {
            document.getElementById('top-products-content').innerHTML = `
                <table>
                    <thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr></thead>
                    <tbody>
                        ${data.top_products.map((p, i) => `
                            <tr>
                                <td><strong>${i + 1}. ${p.product_name}</strong></td>
                                <td>${p.total_quantity_sold}</td>
                                <td style="font-weight:600;color:var(--accent-400);">$${p.total_revenue.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            document.getElementById('top-products-content').innerHTML = '<p class="text-muted">No sales in this period</p>';
        }

        // Daily breakdown
        if (data.daily_breakdown.length > 0) {
            document.getElementById('daily-breakdown-content').innerHTML = `
                <div style="max-height:300px;overflow-y:auto;">
                    <table>
                        <thead><tr><th>Date</th><th>Revenue</th><th>Txns</th><th>Items</th></tr></thead>
                        <tbody>
                            ${data.daily_breakdown.map(d => `
                                <tr>
                                    <td>${d.date}</td>
                                    <td style="font-weight:600;">$${d.total_revenue.toFixed(2)}</td>
                                    <td>${d.total_transactions}</td>
                                    <td>${d.total_items_sold}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function exportReport(format) {
    const startDate = document.getElementById('report-start-date').value;
    const endDate = document.getElementById('report-end-date').value;
    if (!startDate || !endDate) { toast('Select date range first', 'warning'); return; }

    try {
        const res = await api(`/reports/export/${format}?start_date=${startDate}&end_date=${endDate}`);
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fastpos_sales_${startDate}_${endDate}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast(`Report exported as ${format.toUpperCase()}`, 'success');
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function downloadInvoice() {
    if (!currentViewingTransactionId) return;
    try {
        const res = await api(`/transactions/${currentViewingTransactionId}/invoice`);
        if (!res.ok) throw new Error('Invoice generation failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice_${currentViewingTransactionId.substring(0, 8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast('Invoice downloaded', 'success');
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

let usersPage = 1;

async function loadUsers(page = 1) {
    usersPage = page;
    try {
        const data = await apiJSON(`/users/?page=${page}&page_size=15`);
        renderUsersTable(data);
    } catch (e) {
        toast('Failed to load users', 'error');
    }
}

function renderUsersTable(data) {
    const tbody = document.getElementById('users-table-body');
    if (data.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No users found</td></tr>';
        return;
    }
    tbody.innerHTML = data.users.map(u => `
        <tr>
            <td><strong>${u.full_name}</strong><br><span class="text-muted" style="font-size:0.8rem;">@${u.username}</span></td>
            <td>${u.email}</td>
            <td><span class="badge ${u.role === 'admin' ? 'badge-info' : 'badge-neutral'}">${u.role}</span></td>
            <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>${new Date(u.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-ghost btn-sm text-danger" onclick="deactivateUser(${u.id}, '${u.username}')" ${u.username === currentUser?.username ? 'disabled' : ''}>
                    Deactivate
                </button>
            </td>
        </tr>
    `).join('');

    renderPagination('users-pagination', data, loadUsers);
}

function openUserModal() {
    document.getElementById('user-form').reset();
    openModal('user-modal');
}

document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        username: document.getElementById('user-username').value,
        full_name: document.getElementById('user-fullname').value,
        email: document.getElementById('user-email').value,
        password: document.getElementById('user-password').value,
        role: document.getElementById('user-role').value,
    };
    try {
        await apiJSON('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
        toast('User created', 'success');
        closeModal('user-modal');
        loadUsers(usersPage);
    } catch (e) {
        toast(e.message, 'error');
    }
});

async function deactivateUser(id, username) {
    if (!confirm(`Deactivate user "${username}"?`)) return;
    try {
        await apiJSON(`/users/${id}`, { method: 'DELETE' });
        toast(`${username} deactivated`, 'success');
        loadUsers(usersPage);
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
    });
});

// Close modals on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    }
});

function renderPagination(containerId, data, loadFn) {
    const totalPages = Math.ceil(data.total / data.page_size);
    const container = document.getElementById(containerId);

    if (totalPages <= 1) { container.innerHTML = ''; return; }

    container.innerHTML = `
        <button ${data.page <= 1 ? 'disabled' : ''} onclick="${loadFn.name}(${data.page - 1})">Prev</button>
        <span>Page ${data.page} of ${totalPages}</span>
        <button ${data.page >= totalPages ? 'disabled' : ''} onclick="${loadFn.name}(${data.page + 1})">Next</button>
    `;
}

function toast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
        <span>${type === 'success' ? '\u2713' : type === 'error' ? '\u2717' : '\u26A0'}</span>
        <span>${message}</span>
    `;
    container.appendChild(el);
    setTimeout(() => { el.classList.add('fadeOut'); setTimeout(() => el.remove(), 300); }, 3000);
}

// ═══════════════════════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

(async function init() {
    if (authToken) {
        try {
            await loadCurrentUser();
            showApp();
        } catch {
            logout();
        }
    }
})();
