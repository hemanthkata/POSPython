export const API_BASE = 'http://localhost:8080/api/v1';

export async function tryRefreshToken() {
    const refreshToken = localStorage.getItem('fastpos_refresh');
    if (!refreshToken) return false;

    try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('fastpos_token', data.access_token);
            localStorage.setItem('fastpos_refresh', data.refresh_token);
            return data.access_token;
        }
    } catch (e) {
        // fail silently
    }
    return false;
}

export async function api(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    let authToken = localStorage.getItem('fastpos_token');

    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

    if (response.status === 401 && localStorage.getItem('fastpos_refresh')) {
        authToken = await tryRefreshToken();
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
            return fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        } else {
            // Wait, we should handle logout. We can dispatch a custom event that AuthContext listens to.
            window.dispatchEvent(new Event('auth:logout'));
        }
    }
    return response;
}

export async function apiJSON(endpoint, options = {}) {
    const res = await api(endpoint, options);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(err.detail || 'Something went wrong');
    }
    return res.json();
}
