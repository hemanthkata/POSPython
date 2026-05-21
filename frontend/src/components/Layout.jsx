import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Toast } from './Toast';
import { LayoutDashboard, ShoppingCart, Package, ListOrdered, BarChart2, Users, LogOut } from 'lucide-react';

export function Layout() {
    const { currentUser, logout } = useAuth();
    const isAdmin = currentUser?.role === 'admin';

    if (!currentUser) return null; // should redirect to login, but ProtectedRoute handles it

    return (
        <div className="app-layout">
            <Toast />
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <h1>FastPOS</h1>
                    <span>Retail Management System</span>
                </div>
                <nav className="sidebar-nav">
                    <div className="nav-section-label">Main Menu</div>
                    <NavLink to="/dashboard" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <LayoutDashboard /> Dashboard
                    </NavLink>
                    <NavLink to="/pos" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <ShoppingCart /> POS Terminal
                    </NavLink>
                    <NavLink to="/products" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Package /> Products
                    </NavLink>
                    <NavLink to="/transactions" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <ListOrdered /> Transactions
                    </NavLink>

                    {isAdmin && (
                        <>
                            <div className="nav-section-label" id="admin-section-label">Administration</div>
                            <NavLink to="/reports" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                                <BarChart2 /> Reports
                            </NavLink>
                            <NavLink to="/users" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                                <Users /> Users
                            </NavLink>
                        </>
                    )}
                </nav>
                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar" id="user-avatar">
                            {currentUser.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-details">
                            <div className="name" id="user-display-name">{currentUser.full_name}</div>
                            <div className="role" id="user-display-role">{currentUser.role}</div>
                        </div>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-block" style={{marginTop: '0.5rem'}} onClick={logout}>
                        <LogOut size={16} /> Sign Out
                    </button>
                </div>
            </aside>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
