import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiJSON, API_BASE } from '../utils/api';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadCurrentUser = useCallback(async () => {
        try {
            const user = await apiJSON('/users/me');
            setCurrentUser(user);
        } catch (error) {
            console.error("Failed to load user", error);
            logout();
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('fastpos_token');
        if (token) {
            loadCurrentUser().finally(() => setLoading(false));
        } else {
            setLoading(false);
        }

        const handleLogoutEvent = () => logout();
        window.addEventListener('auth:logout', handleLogoutEvent);
        return () => window.removeEventListener('auth:logout', handleLogoutEvent);
    }, [loadCurrentUser]);

    const login = async (username, password) => {
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
        localStorage.setItem('fastpos_token', data.access_token);
        localStorage.setItem('fastpos_refresh', data.refresh_token);
        await loadCurrentUser();
    };

    const logout = () => {
        setCurrentUser(null);
        localStorage.removeItem('fastpos_token');
        localStorage.removeItem('fastpos_refresh');
    };

    return (
        <AuthContext.Provider value={{ currentUser, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
