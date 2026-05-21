import React, { useState, useEffect } from 'react';
import { apiJSON, api } from '../utils/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';

const categoryIcons = {
    food: '\uD83C\uDF54', beverage: '\u2615', electronics: '\uD83D\uDCF1',
    clothing: '\uD83D\uDC55', grocery: '\uD83D\uDED2', health: '\uD83D\uDC8A',
    stationery: '\u270F\uFE0F', other: '\uD83D\uDCE6',
};

export function POS() {
    const { currentUser } = useAuth();
    const { cart, addToCart, updateQuantity, removeFromCart, totals, discountPercent, setDiscountPercent, clearCart } = useCart();
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [receipt, setReceipt] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('card');
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    const loadProducts = async () => {
        try {
            const data = await apiJSON('/products/?page_size=100&in_stock_only=false');
            setProducts(data.products);
        } catch (error) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Failed to load products', type: 'error' } }));
        }
    };

    useEffect(() => {
        loadProducts();
    }, []);

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter ? p.category === categoryFilter : true;
        return matchesSearch && matchesCategory;
    });

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setIsCheckingOut(true);
        try {
            const payload = {
                items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
                payment_method: paymentMethod,
                discount_percent: discountPercent,
            };

            const receiptData = await apiJSON('/transactions/checkout', {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            setReceipt(receiptData);
            clearCart();
            loadProducts(); // refresh stock
        } catch (error) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: error.message, type: 'error' } }));
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="pos-layout">
            <div>
                <div className="page-header" style={{ marginBottom: '1rem' }}>
                    <h2>Point of Sale</h2>
                    <div className="form-inline">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                                <option value="">All Categories</option>
                                <option value="food">Food</option>
                                <option value="beverage">Beverage</option>
                                <option value="electronics">Electronics</option>
                                <option value="clothing">Clothing</option>
                                <option value="grocery">Grocery</option>
                                <option value="health">Health</option>
                                <option value="stationery">Stationery</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="product-grid">
                    {filteredProducts.length === 0 ? (
                        <p className="text-muted text-center" style={{ gridColumn: '1/-1', padding: '3rem' }}>No products found</p>
                    ) : (
                        filteredProducts.map(p => (
                            <div
                                key={p.id}
                                className={`product-tile ${p.is_out_of_stock ? 'out-of-stock' : ''}`}
                                onClick={() => !p.is_out_of_stock && addToCart(p)}
                            >
                                <span className="product-emoji">{categoryIcons[p.category] || categoryIcons.other}</span>
                                <div className="product-name" title={p.name}>{p.name}</div>
                                <div className="product-price">${p.price.toFixed(2)}</div>
                                <div className="product-stock">{p.is_out_of_stock ? 'Out of stock' : `${p.stock_quantity} in stock`}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="cart-panel">
                <div className="cart-header">
                    <h3>Current Order</h3>
                    <span className="cart-count">{totals.totalItems}</span>
                </div>
                <div className="cart-items">
                    {cart.length === 0 ? (
                        <div className="cart-empty">
                            <span>Cart is empty</span>
                            <span style={{ fontSize: '0.78rem' }}>Click products to add</span>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.product_id} className="cart-item">
                                <div className="cart-item-info">
                                    <div className="cart-item-name">{item.name}</div>
                                    <div className="cart-item-price">${item.price.toFixed(2)} each</div>
                                </div>
                                <div className="cart-item-qty">
                                    <button onClick={() => updateQuantity(item.product_id, -1)}>-</button>
                                    <span>{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.product_id, 1)}>+</button>
                                </div>
                                <div className="cart-item-total">${(item.price * item.quantity).toFixed(2)}</div>
                                <button className="cart-item-remove" onClick={() => removeFromCart(item.product_id)}>&times;</button>
                            </div>
                        ))
                    )}
                </div>

                <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                    <div style={{ display: 'grid', gap: '0.4rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span className="text-muted">Subtotal</span>
                            <span>${totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', alignItems: 'center' }}>
                            <span className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                Discount (%)
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={discountPercent}
                                    onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)}
                                    style={{ width: '60px', padding: '0.2rem 0.4rem', fontSize: '0.8rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'white' }}
                                />
                            </span>
                            <span className="text-danger">-${totals.discountAmount.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span className="text-muted">Tax ({totals.taxRate}%)</span>
                            <span>${totals.taxAmount.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 700, paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                            <span>Total</span>
                            <span style={{ color: 'var(--accent-400)' }}>${totals.total.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ padding: '0.6rem' }}>
                            <option value="cash">Cash</option>
                            <option value="card">Credit Card</option>
                            <option value="mobile">Mobile Payment</option>
                        </select>
                    </div>

                    <button
                        className="btn btn-primary btn-block btn-lg"
                        disabled={cart.length === 0 || isCheckingOut}
                        onClick={handleCheckout}
                    >
                        {isCheckingOut ? <div className="spinner"></div> : `Checkout $${totals.total.toFixed(2)}`}
                    </button>
                </div>
            </div>

            <Modal isOpen={!!receipt} onClose={() => setReceipt(null)} title="Receipt">
                {receipt && (
                    <div style={{ textAlign: 'center' }}>
                        <h3>Payment Successful!</h3>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            ID: {receipt.transaction_id}
                        </div>
                        <table style={{ width: '100%', marginBottom: '1rem' }}>
                            <tbody>
                                {receipt.items.map((i, idx) => (
                                    <tr key={idx}>
                                        <td style={{ textAlign: 'left' }}>{i.product_name} x{i.quantity}</td>
                                        <td style={{ textAlign: 'right' }}>${i.line_total.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <hr style={{ borderColor: 'var(--border-subtle)', marginBottom: '1rem' }} />
                        <div style={{ display: 'grid', gap: '0.4rem', textAlign: 'left' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                                <span className="text-muted">Subtotal</span><span>${receipt.subtotal.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                                <span className="text-muted">Discount</span><span>-${receipt.discount_amount.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                                <span className="text-muted">Tax</span><span>${receipt.tax_amount.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700, marginTop: '0.5rem' }}>
                                <span>Total</span><span style={{ color: 'var(--accent-400)' }}>${receipt.total_amount.toFixed(2)}</span>
                            </div>
                        </div>
                        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button className="btn btn-primary" onClick={() => setReceipt(null)}>New Sale</button>
                            <button className="btn btn-ghost" onClick={async () => {
                                try {
                                    const res = await api(`/transactions/${receipt.transaction_id}/invoice`);
                                    if (!res.ok) throw new Error('Failed to generate invoice');
                                    const blob = await res.blob();
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `invoice_${receipt.transaction_id.substring(0, 8)}.pdf`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                } catch (e) {
                                    window.dispatchEvent(new CustomEvent('toast', { detail: { message: e.message, type: 'error' } }));
                                }
                            }}>📄 Download PDF</button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
