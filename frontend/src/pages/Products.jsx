import React, { useState, useEffect } from 'react';
import { apiJSON } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';

export function Products() {
    const { currentUser } = useAuth();
    const isAdmin = currentUser?.role === 'admin';
    const [products, setProducts] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(15);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '', sku: '', description: '', category: 'other', price: '', cost_price: '', stock_quantity: '', low_stock_threshold: 10
    });

    const loadProducts = async (p = page) => {
        let url = `/products/?page=${p}&page_size=${pageSize}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (category) url += `&category=${category}`;

        try {
            const data = await apiJSON(url);
            setProducts(data.products);
            setTotal(data.total);
            setPage(data.page);
        } catch (error) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Failed to load products', type: 'error' } }));
        }
    };

    useEffect(() => {
        loadProducts(1);
    }, [search, category]);

    const handleOpenModal = (product = null) => {
        if (product) {
            setEditingProduct(product);
            setFormData({
                name: product.name,
                sku: product.sku,
                description: product.description || '',
                category: product.category,
                price: product.price,
                cost_price: product.cost_price,
                stock_quantity: product.stock_quantity,
                low_stock_threshold: product.low_stock_threshold
            });
        } else {
            setEditingProduct(null);
            setFormData({ name: '', sku: '', description: '', category: 'other', price: '', cost_price: '', stock_quantity: '', low_stock_threshold: 10 });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            name: formData.name,
            description: formData.description || null,
            category: formData.category,
            price: parseFloat(formData.price),
            cost_price: parseFloat(formData.cost_price) || 0,
            stock_quantity: parseInt(formData.stock_quantity) || 0,
            low_stock_threshold: parseInt(formData.low_stock_threshold) || 10,
        };

        try {
            if (editingProduct) {
                await apiJSON(`/products/${editingProduct.id}`, { method: 'PUT', body: JSON.stringify(payload) });
                window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Product updated', type: 'success' } }));
            } else {
                payload.sku = formData.sku;
                await apiJSON('/products/', { method: 'POST', body: JSON.stringify(payload) });
                window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Product created', type: 'success' } }));
            }
            setIsModalOpen(false);
            loadProducts();
        } catch (error) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: error.message, type: 'error' } }));
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Deactivate "${name}"? This will hide it from the POS.`)) return;
        try {
            await apiJSON(`/products/${id}`, { method: 'DELETE' });
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: `${name} deactivated`, type: 'success' } }));
            loadProducts();
        } catch (error) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: error.message, type: 'error' } }));
        }
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Products</h2>
                    <p>Manage your inventory and pricing</p>
                </div>
                {isAdmin && (
                    <button className="btn btn-primary" onClick={() => handleOpenModal()}>+ Add Product</button>
                )}
            </div>

            <div className="card">
                <div className="card-header">
                    <div className="form-inline" style={{ width: '100%', maxWidth: '600px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <input type="text" placeholder="Search by name or SKU..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <select value={category} onChange={e => setCategory(e.target.value)}>
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
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>SKU</th>
                                <th>Category</th>
                                <th>Price</th>
                                <th>Stock</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.length === 0 ? (
                                <tr><td colSpan="7" className="text-center text-muted" style={{ padding: '2rem' }}>No products found</td></tr>
                            ) : (
                                products.map(p => (
                                    <tr key={p.id}>
                                        <td><strong>{p.name}</strong></td>
                                        <td><code style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.sku}</code></td>
                                        <td><span className="badge badge-info">{p.category}</span></td>
                                        <td style={{ fontWeight: 600 }}>${p.price.toFixed(2)}</td>
                                        <td>
                                            <span className={p.is_out_of_stock ? 'text-danger' : p.is_low_stock ? 'text-warning' : 'text-success'} style={{ fontWeight: 600 }}>
                                                {p.stock_quantity}
                                            </span>
                                        </td>
                                        <td><span className={`badge ${p.is_active ? 'badge-success' : 'badge-neutral'}`}>{p.is_active ? 'Active' : 'Inactive'}</span></td>
                                        <td>
                                            {isAdmin ? (
                                                <>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleOpenModal(p)}>Edit</button>
                                                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(p.id, p.name)}>Delete</button>
                                                </>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                        <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => loadProducts(page - 1)}>Prev</button>
                        <span className="text-muted" style={{ fontSize: '0.85rem' }}>Page {page} of {totalPages}</span>
                        <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => loadProducts(page + 1)}>Next</button>
                    </div>
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProduct ? 'Edit Product' : 'Add Product'}>
                <form onSubmit={handleSubmit}>
                    <div className="form-inline">
                        <div className="form-group">
                            <label>Product Name</label>
                            <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>SKU</label>
                            <input type="text" required disabled={!!editingProduct} value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Description</label>
                        <textarea rows="2" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}></textarea>
                    </div>
                    <div className="form-inline">
                        <div className="form-group">
                            <label>Category</label>
                            <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
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
                        <div className="form-group">
                            <label>Selling Price ($)</label>
                            <input type="number" step="0.01" min="0" required value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Cost Price ($)</label>
                            <input type="number" step="0.01" min="0" value={formData.cost_price} onChange={e => setFormData({ ...formData, cost_price: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-inline">
                        <div className="form-group">
                            <label>Current Stock</label>
                            <input type="number" min="0" value={formData.stock_quantity} onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Low Stock Alert At</label>
                            <input type="number" min="0" value={formData.low_stock_threshold} onChange={e => setFormData({ ...formData, low_stock_threshold: e.target.value })} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Save Product</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
