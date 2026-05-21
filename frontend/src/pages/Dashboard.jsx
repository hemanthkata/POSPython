import React, { useEffect, useState } from 'react';
import { apiJSON } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Package, DollarSign, AlertTriangle, XCircle, Activity, ShoppingCart, TrendingUp } from 'lucide-react';

export function Dashboard() {
    const { currentUser } = useAuth();
    const [inventory, setInventory] = useState(null);
    const [dailySales, setDailySales] = useState(null);
    const isAdmin = currentUser?.role === 'admin';

    useEffect(() => {
        const loadData = async () => {
            try {
                const inv = await apiJSON('/reports/inventory');
                setInventory(inv);

                if (isAdmin) {
                    const today = new Date().toISOString().split('T')[0];
                    const daily = await apiJSON(`/reports/sales/daily?target_date=${today}`);
                    setDailySales(daily);
                }
            } catch (error) {
                window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Failed to load dashboard data', type: 'error' } }));
            }
        };
        loadData();
    }, [isAdmin]);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Dashboard</h2>
                    <p>Overview of your store's performance</p>
                </div>
            </div>

            {inventory && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon blue">
                            <Package />
                        </div>
                        <div className="stat-info">
                            <div className="stat-value">{inventory.active_products}</div>
                            <div className="stat-label">Active Products</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon green">
                            <DollarSign />
                        </div>
                        <div className="stat-info">
                            <div className="stat-value">${inventory.total_inventory_value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                            <div className="stat-label">Inventory Value</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon amber">
                            <AlertTriangle />
                        </div>
                        <div className="stat-info">
                            <div className="stat-value">{inventory.low_stock_count}</div>
                            <div className="stat-label">Low Stock Items</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon rose">
                            <XCircle />
                        </div>
                        <div className="stat-info">
                            <div className="stat-value">{inventory.out_of_stock_count}</div>
                            <div className="stat-label">Out of Stock</div>
                        </div>
                    </div>
                </div>
            )}

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem'}}>
                <div className="card">
                    <div className="card-header">
                        <h3>Inventory Health</h3>
                    </div>
                    {inventory ? (
                        <div style={{display: 'grid', gap: '0.75rem'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <span className="text-muted" style={{fontSize: '0.88rem'}}>Total Products</span>
                                <span style={{fontWeight: 600}}>{inventory.total_products}</span>
                            </div>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <span className="text-muted" style={{fontSize: '0.88rem'}}>Active</span>
                                <span className="badge badge-success">{inventory.active_products}</span>
                            </div>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <span className="text-muted" style={{fontSize: '0.88rem'}}>Low Stock</span>
                                <span className="badge badge-warning">{inventory.low_stock_count}</span>
                            </div>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <span className="text-muted" style={{fontSize: '0.88rem'}}>Out of Stock</span>
                                <span className="badge badge-danger">{inventory.out_of_stock_count}</span>
                            </div>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)'}}>
                                <span className="text-muted" style={{fontSize: '0.88rem'}}>Inventory Value</span>
                                <span style={{fontWeight: 700, color: 'var(--accent-400)'}}>${inventory.total_inventory_value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                        </div>
                    ) : <p className="text-muted">Loading...</p>}
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3>Today's Sales</h3>
                    </div>
                    {!isAdmin ? (
                        <p className="text-muted">Admin access required for sales data</p>
                    ) : dailySales ? (
                        <div style={{display: 'grid', gap: '0.75rem'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <span className="text-muted" style={{fontSize: '0.88rem'}}>Revenue</span>
                                <span style={{fontWeight: 700, color: 'var(--accent-400)', fontSize: '1.2rem'}}>${dailySales.total_revenue.toFixed(2)}</span>
                            </div>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <span className="text-muted" style={{fontSize: '0.88rem'}}>Transactions</span>
                                <span style={{fontWeight: 600}}>{dailySales.total_transactions}</span>
                            </div>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <span className="text-muted" style={{fontSize: '0.88rem'}}>Items Sold</span>
                                <span style={{fontWeight: 600}}>{dailySales.total_items_sold}</span>
                            </div>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <span className="text-muted" style={{fontSize: '0.88rem'}}>Avg. Transaction</span>
                                <span style={{fontWeight: 600}}>${dailySales.average_transaction_value.toFixed(2)}</span>
                            </div>
                        </div>
                    ) : <p className="text-muted">No sales data yet today</p>}
                </div>
            </div>
        </div>
    );
}
