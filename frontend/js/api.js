/**
 * MOBIXA - Centralized Frontend API Client & Auth Guard
 */

const API_BASE = '/api';

// Shared API Caller
async function apiCall(endpoint, method = 'GET', body = null) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const token = localStorage.getItem('mobixa_token');

    const headers = {
        'Accept': 'application/json'
    };

    if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
        method,
        headers,
        credentials: 'include' // Sends HTTP-only cookies
    };

    if (body) {
        options.body = body instanceof FormData ? body : JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);

        if (response.status === 401) {
            // Expired or invalid authentication
            localStorage.removeItem('mobixa_token');
            localStorage.removeItem('mobixa_user');
            if (!window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('/')) {
                window.location.href = 'login.html?expired=1';
            }
            return null;
        }

        const data = await response.json();
        return { ok: response.ok, status: response.status, data };
    } catch (error) {
        console.error('[Mobixa API Error]:', error);
        return { ok: false, status: 0, data: { message: 'Network or server connection failed. Please ensure the backend is running.' } };
    }
}

// Authentication guard for protected pages
async function requireAuth(allowedRoles = []) {
    const res = await apiCall('/auth/me');

    if (!res || !res.ok || !res.data || !res.data.user) {
        localStorage.removeItem('mobixa_token');
        localStorage.removeItem('mobixa_user');
        window.location.href = 'login.html';
        return null;
    }

    const user = res.data.user;
    localStorage.setItem('mobixa_user', JSON.stringify(user));

    // Role verification
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        if (user.role === 'employee') {
            window.location.href = 'employee-dashboard.html';
        } else {
            window.location.href = 'dashboard.html';
        }
        return null;
    }

    // Update UI headers if present
    document.querySelectorAll('.user-name, .profile-name, #userNameDisplay').forEach(el => {
        el.textContent = user.name;
    });

    document.querySelectorAll('.user-role, .profile-role, #userRoleDisplay').forEach(el => {
        el.textContent = user.role === 'admin' ? 'Administrator' : (user.designation || 'Staff');
    });

    document.querySelectorAll('.user-avatar, .profile-avatar').forEach(el => {
        const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        el.textContent = initials || 'U';
    });

    return user;
}

// Global Logout
async function logout() {
    try {
        await apiCall('/auth/logout', 'POST');
    } catch (e) {
        console.warn('Logout request error:', e);
    }
    localStorage.removeItem('mobixa_token');
    localStorage.removeItem('mobixa_user');
    window.location.href = 'login.html';
}

// Toast notification helper
function showToast(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bg = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#6366f1');
    toast.style.cssText = `
        background: ${bg};
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-family: inherit;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 260px;
        animation: slideIn 0.3s ease;
        pointer-events: auto;
    `;

    const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
    toast.innerHTML = `<strong>${icon}</strong> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.4s ease';
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// Format currency
function formatCurrency(amount) {
    return '₹' + Number(amount || 0).toLocaleString('en-IN');
}

// Format date
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
