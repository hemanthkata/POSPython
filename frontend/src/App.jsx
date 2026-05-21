import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { Products } from './pages/Products';
import { Transactions } from './pages/Transactions';
import { Reports } from './pages/Reports';
import { Users } from './pages/Users';

function ProtectedRoute({ adminOnly = false }) {
    const { currentUser, loading } = useAuth();

    if (loading) return <div className="login-wrapper"><div className="spinner"></div></div>;
    
    if (!currentUser) return <Navigate to="/login" replace />;
    
    if (adminOnly && currentUser.role !== 'admin') {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <CartProvider>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route element={<ProtectedRoute />}>
                            <Route element={<Layout />}>
                                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                                <Route path="/dashboard" element={<Dashboard />} />
                                <Route path="/pos" element={<POS />} />
                                <Route path="/products" element={<Products />} />
                                <Route path="/transactions" element={<Transactions />} />
                                
                                {/* Admin routes */}
                                <Route element={<ProtectedRoute adminOnly={true} />}>
                                    <Route path="/reports" element={<Reports />} />
                                    <Route path="/users" element={<Users />} />
                                </Route>
                            </Route>
                        </Route>
                    </Routes>
                </CartProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}
