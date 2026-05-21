import React, { useState, useEffect } from 'react';
import { apiJSON } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';

export function Users() {
    const { currentUser } = useAuth();
    const isAdmin = currentUser?.role === 'admin';
    const [users, setUsers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ username: '', email: '', password: '', full_name: '', role: 'cashier' });

    const loadUsers = async () => {
        try {
            const data = await apiJSON('/users/');
            setUsers(data);
        } catch (error) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Failed to load users', type: 'error' } }));
        }
    };

    useEffect(() => {
        if (isAdmin) loadUsers();
    }, [isAdmin]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await apiJSON('/auth/register', { method: 'POST', body: JSON.stringify(formData) });
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'User created', type: 'success' } }));
            setIsModalOpen(false);
            setFormData({ username: '', email: '', password: '', full_name: '', role: 'cashier' });
            loadUsers();
        } catch (error) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: error.message, type: 'error' } }));
        }
    };

    const handleDelete = async (id, username) => {
        if (username === currentUser.username) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Cannot deactivate yourself', type: 'warning' } }));
            return;
        }
        if (!window.confirm(`Deactivate user "${username}"?`)) return;
        try {
            await apiJSON(`/users/${id}`, { method: 'DELETE' });
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: `User deactivated`, type: 'success' } }));
            loadUsers();
        } catch (error) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: error.message, type: 'error' } }));
        }
    };

    if (!isAdmin) return <div className="text-muted text-center" style={{ padding: '3rem' }}>Admin access required</div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>User Management</h2>
                    <p>Manage system access and roles</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>+ Add User</button>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 ? (
                                <tr><td colSpan="6" className="text-center text-muted" style={{ padding: '2rem' }}>No users found</td></tr>
                            ) : (
                                users.map(u => (
                                    <tr key={u.id}>
                                        <td><strong>{u.full_name}</strong></td>
                                        <td><code style={{ fontSize: '0.8rem' }}>{u.username}</code></td>
                                        <td>{u.email}</td>
                                        <td style={{ textTransform: 'capitalize' }}>
                                            <span className={`badge ${u.role === 'admin' ? 'badge-danger' : 'badge-info'}`}>{u.role}</span>
                                        </td>
                                        <td>
                                            <span className={`badge ${u.is_active ? 'badge-success' : 'badge-neutral'}`}>
                                                {u.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(u.id, u.username)}>Deactivate</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New User">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Full Name</label>
                        <input type="text" required value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
                    </div>
                    <div className="form-inline">
                        <div className="form-group">
                            <label>Username</label>
                            <input type="text" required value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Email</label>
                            <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-inline">
                        <div className="form-group">
                            <label>Role</label>
                            <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                <option value="cashier">Cashier</option>
                                <option value="admin">Administrator</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Temporary Password</label>
                            <input type="password" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Create User</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
