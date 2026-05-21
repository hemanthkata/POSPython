import React, { useState, useEffect } from 'react';

export function Toast() {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        const handleToast = (e) => {
            const id = Date.now();
            setToasts(prev => [...prev, { id, ...e.detail }]);
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 3000);
        };
        window.addEventListener('toast', handleToast);
        return () => window.removeEventListener('toast', handleToast);
    }, []);

    return (
        <div id="toast-container" className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast ${t.type} ${!t.id ? 'fadeOut' : ''}`}>
                    <span>{t.type === 'success' ? '\u2713' : t.type === 'error' ? '\u2717' : '\u26A0'}</span>
                    <span>{t.message}</span>
                </div>
            ))}
        </div>
    );
}
