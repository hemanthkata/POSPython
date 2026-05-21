import React, { useState, useEffect } from 'react';
import { apiJSON, api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';

export function Transactions() {
    const { currentUser } = useAuth();
    const isAdmin = currentUser?.role === 'admin';
    const [transactions, setTransactions] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(15);
    const [selectedTx, setSelectedTx] = useState(null);

    const loadTransactions = async (p = page) => {
        try {
            const data = await apiJSON(`/transactions/?page=${p}&page_size=${pageSize}`);
            setTransactions(data.transactions);
            setTotal(data.total);
            setPage(data.page);
        } catch (error) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Failed to load transactions', type: 'error' } }));
        }
    };

    useEffect(() => {
        loadTransactions(1);
    }, []);

    const viewTransaction = async (txId) => {
        try {
            const t = await apiJSON(`/transactions/${txId}`);
            setSelectedTx(t);
        } catch (error) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Failed to load transaction', type: 'error' } }));
        }
    };

    const handleRefund = async (txId) => {
        if (!window.confirm('Refund this transaction? Stock will be restored.')) return;
        try {
            await apiJSON(`/transactions/${txId}/refund`, { method: 'POST' });
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Transaction refunded', type: 'success' } }));
            loadTransactions(page);
            setSelectedTx(null);
        } catch (error) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: error.message, type: 'error' } }));
        }
    };

    const downloadInvoice = async (txId) => {
        try {
            const res = await api(`/transactions/${txId}/invoice`);
            if (!res.ok) throw new Error('Failed to download invoice');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoice_${txId.substring(0, 8)}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: e.message, type: 'error' } }));
        }
    };

    const totalPages = Math.ceil(total / pageSize);
    const statusClass = { completed: 'badge-success', refunded: 'badge-warning', pending: 'badge-info', cancelled: 'badge-danger' };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Transactions</h2>
                    <p>Sales history and receipts</p>
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Date</th>
                                <th>Items</th>
                                <th>Total</th>
                                <th>Payment</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.length === 0 ? (
                                <tr><td colSpan="7" className="text-center text-muted" style={{ padding: '2rem' }}>No transactions yet</td></tr>
                            ) : (
                                transactions.map(t => (
                                    <tr key={t.transaction_id}>
                                        <td><code style={{ fontSize: '0.78rem' }}>{t.transaction_id.substring(0, 8)}...</code></td>
                                        <td>{new Date(t.created_at).toLocaleDateString()}</td>
                                        <td>{t.items.reduce((sum, i) => sum + i.quantity, 0)} items</td>
                                        <td style={{ fontWeight: 600 }}>${t.total_amount.toFixed(2)}</td>
                                        <td><span className="badge badge-neutral">{t.payment_method}</span></td>
                                        <td><span className={`badge ${statusClass[t.status] || 'badge-neutral'}`}>{t.status}</span></td>
                                        <td>
                                            <button className="btn btn-ghost btn-sm" onClick={() => viewTransaction(t.transaction_id)}>View</button>
                                            {isAdmin && t.status === 'completed' && (
                                                <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleRefund(t.transaction_id)}>Refund</button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                        <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => loadTransactions(page - 1)}>Prev</button>
                        <span className="text-muted" style={{ fontSize: '0.85rem' }}>Page {page} of {totalPages}</span>
                        <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => loadTransactions(page + 1)}>Next</button>
                    </div>
                )}
            </div>

            <Modal isOpen={!!selectedTx} onClose={() => setSelectedTx(null)} title="Transaction Details">
                {selectedTx && (
                    <div>
                        <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-muted">Transaction ID</span>
                                <code style={{ fontSize: '0.8rem' }}>{selectedTx.transaction_id}</code>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-muted">Status</span>
                                <span className={`badge ${selectedTx.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>{selectedTx.status}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-muted">Payment</span><span>{selectedTx.payment_method}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-muted">Date</span><span>{new Date(selectedTx.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>Line Items</h4>
                        <table style={{ width: '100%', marginBottom: '1rem' }}>
                            <thead><tr><th style={{ textAlign: 'left' }}>Item</th><th>Qty</th><th>Price</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                            <tbody>
                                {selectedTx.items.map((i, idx) => (
                                    <tr key={idx}>
                                        <td>{i.product_name}</td>
                                        <td style={{ textAlign: 'center' }}>{i.quantity}</td>
                                        <td style={{ textAlign: 'center' }}>${i.unit_price.toFixed(2)}</td>
                                        <td style={{ fontWeight: 600, textAlign: 'right' }}>${i.line_total.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <hr style={{ borderColor: 'var(--border-subtle)', marginBottom: '1rem' }} />
                        <div style={{ display: 'grid', gap: '0.4rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                                <span className="text-muted">Subtotal</span><span>${selectedTx.subtotal.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                                <span className="text-muted">Discount</span><span>-${selectedTx.discount_amount.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                                <span className="text-muted">Tax</span><span>${selectedTx.tax_amount.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700, paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                                <span>Total</span><span style={{ color: 'var(--accent-400)' }}>${selectedTx.total_amount.toFixed(2)}</span>
                            </div>
                        </div>
                        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            {isAdmin && selectedTx.status === 'completed' && (
                                <button className="btn btn-ghost text-danger" onClick={() => handleRefund(selectedTx.transaction_id)}>Refund</button>
                            )}
                            <button className="btn btn-primary" onClick={() => downloadInvoice(selectedTx.transaction_id)}>
                                Download PDF Invoice
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
