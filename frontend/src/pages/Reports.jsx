import React, { useState, useEffect } from 'react';
import { apiJSON, api } from '../utils/api';
import { DollarSign, FileText, ArrowDownToLine } from 'lucide-react';

export function Reports() {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [data, setData] = useState(null);

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        setStartDate(weekAgo);
        setEndDate(today);
    }, []);

    const loadReport = async () => {
        if (!startDate || !endDate) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Select date range', type: 'warning' } }));
            return;
        }
        try {
            const reportData = await apiJSON(`/reports/sales/summary?start_date=${startDate}&end_date=${endDate}`);
            setData(reportData);
        } catch (error) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: error.message, type: 'error' } }));
        }
    };

    useEffect(() => {
        if (startDate && endDate) {
            loadReport();
        }
    }, [startDate, endDate]);

    const exportReport = async (format) => {
        if (!startDate || !endDate) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Select date range first', type: 'warning' } }));
            return;
        }
        try {
            const res = await api(`/reports/export/${format}?start_date=${startDate}&end_date=${endDate}`);
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fastpos_sales_${startDate}_to_${endDate}.${format}`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: e.message, type: 'error' } }));
        }
    };

    return (
        <div>
            <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                <div>
                    <h2>Sales Reports</h2>
                    <p>Analytics and performance metrics</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-ghost" onClick={() => exportReport('csv')}>
                        <FileText size={16} /> CSV
                    </button>
                    <button className="btn btn-ghost" onClick={() => exportReport('json')}>
                        <ArrowDownToLine size={16} /> JSON
                    </button>
                </div>
            </div>

            <div className="card" style={{ marginBottom: '2rem' }}>
                <div className="form-inline" style={{ alignItems: 'flex-end', maxWidth: '600px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Start Date</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>End Date</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <button className="btn btn-primary" onClick={loadReport} style={{ height: '42px' }}>Apply Filter</button>
                </div>
            </div>

            {data && (
                <>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon green">
                                <DollarSign />
                            </div>
                            <div className="stat-info">
                                <div className="stat-value">${data.total_revenue.toFixed(2)}</div>
                                <div className="stat-label">Total Revenue</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon blue">
                                <FileText />
                            </div>
                            <div className="stat-info">
                                <div className="stat-value">{data.total_transactions}</div>
                                <div className="stat-label">Transactions</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon amber">
                                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>#</span>
                            </div>
                            <div className="stat-info">
                                <div className="stat-value">{data.total_items_sold}</div>
                                <div className="stat-label">Items Sold</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon rose">
                                <DollarSign />
                            </div>
                            <div className="stat-info">
                                <div className="stat-value">${data.average_daily_revenue.toFixed(2)}</div>
                                <div className="stat-label">Avg. Daily Revenue</div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        <div className="card">
                            <div className="card-header">
                                <h3>Top Selling Products</h3>
                            </div>
                            {data.top_products.length > 0 ? (
                                <table>
                                    <thead><tr><th style={{ textAlign: 'left' }}>Product</th><th>Qty Sold</th><th>Revenue</th></tr></thead>
                                    <tbody>
                                        {data.top_products.map((p, i) => (
                                            <tr key={i}>
                                                <td><strong>{i + 1}. {p.product_name}</strong></td>
                                                <td style={{ textAlign: 'center' }}>{p.total_quantity_sold}</td>
                                                <td style={{ fontWeight: 600, color: 'var(--accent-400)', textAlign: 'right' }}>${p.total_revenue.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-muted">No sales in this period</p>
                            )}
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3>Daily Breakdown</h3>
                            </div>
                            {data.daily_breakdown.length > 0 ? (
                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    <table>
                                        <thead><tr><th style={{ textAlign: 'left' }}>Date</th><th>Revenue</th><th>Txns</th><th>Items</th></tr></thead>
                                        <tbody>
                                            {data.daily_breakdown.map((d, i) => (
                                                <tr key={i}>
                                                    <td>{d.date}</td>
                                                    <td style={{ fontWeight: 600 }}>${d.total_revenue.toFixed(2)}</td>
                                                    <td style={{ textAlign: 'center' }}>{d.total_transactions}</td>
                                                    <td style={{ textAlign: 'center' }}>{d.total_items_sold}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-muted">No sales in this period</p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
