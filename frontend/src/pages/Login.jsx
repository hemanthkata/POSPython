import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';

export function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(username, password);
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Welcome back!', type: 'success' } }));
            navigate('/dashboard');
        } catch (error) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: error.message, type: 'error' } }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-wrapper">
            <div className="login-card">
                <div className="logo">
                    <h1>FastPOS</h1>
                    <p>Sign in to your account</p>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            required
                            placeholder="admin"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            required
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{marginTop: '1rem'}}>
                        {loading ? <div className="spinner"></div> : <><LogIn size={18} /> Sign In</>}
                    </button>
                </form>
            </div>
        </div>
    );
}
