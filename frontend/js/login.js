/**
 * MOBIXA - Login Script
 * Handles real authentication with Express/MongoDB backend
 */

let selectedRole = 'admin';

document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is already logged in
    const token = localStorage.getItem('mobixa_token');
    if (token) {
        try {
            const res = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` },
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                if (data.user) {
                    if (data.user.role === 'admin') {
                        window.location.href = 'dashboard.html';
                    } else {
                        window.location.href = 'employee-dashboard.html';
                    }
                    return;
                }
            }
        } catch (e) {
            // Proceed to login form if not authenticated
        }
    }

    // Role switcher
    const adminTab = document.getElementById('adminType');
    const employeeTab = document.getElementById('employeeType');

    if (adminTab) {
        adminTab.addEventListener('click', () => selectLoginType('admin'));
    }
    if (employeeTab) {
        employeeTab.addEventListener('click', () => selectLoginType('employee'));
    }

    // Form submission
    const form = document.getElementById('loginForm') || document.querySelector('form');
    if (form) {
        form.addEventListener('submit', handleLogin);
    }
});

function selectLoginType(type) {
    selectedRole = type;
    const admin = document.getElementById('adminType');
    const employee = document.getElementById('employeeType');

    if (type === 'admin') {
        if (admin) admin.classList.add('active');
        if (employee) employee.classList.remove('active');
    } else {
        if (employee) employee.classList.add('active');
        if (admin) admin.classList.remove('active');
    }
}

function togglePassword() {
    const password = document.getElementById('password');
    if (password) {
        password.type = password.type === 'password' ? 'text' : 'password';
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const usernameInput = document.getElementById('username') || document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const messageEl = document.getElementById('message');
    const submitBtn = document.querySelector('.login-button') || document.querySelector('.login-btn');

    const identifier = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!identifier || !password) {
        showMessage('Please enter both username/email and password.', 'error');
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';
        }
        showMessage('Authenticating...', 'info');

        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                username: identifier,
                email: identifier,
                password: password,
                role: selectedRole
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            showMessage(data.message || 'Invalid credentials. Please try again.', 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
            }
            return;
        }

        showMessage('Login successful! Redirecting...', 'success');

        // Store token & user data
        if (data.token) {
            localStorage.setItem('mobixa_token', data.token);
        }
        if (data.user) {
            localStorage.setItem('mobixa_user', JSON.stringify(data.user));
        }

        setTimeout(() => {
            if (data.user.role === 'admin') {
                window.location.href = 'dashboard.html';
            } else {
                window.location.href = 'employee-dashboard.html';
            }
        }, 600);

    } catch (error) {
        console.error('Login error:', error);
        showMessage('Unable to connect to the server. Ensure the backend is running.', 'error');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    }
}

function showMessage(msg, type) {
    const messageEl = document.getElementById('message');
    if (!messageEl) return;

    messageEl.style.display = 'block';
    messageEl.className = `message ${type}`;
    messageEl.textContent = msg;

    if (type === 'error') {
        messageEl.style.background = 'rgba(239,68,68,0.15)';
        messageEl.style.color = '#f87171';
    } else if (type === 'success') {
        messageEl.style.background = 'rgba(34,197,94,0.15)';
        messageEl.style.color = '#4ade80';
    } else {
        messageEl.style.background = 'rgba(99,102,241,0.15)';
        messageEl.style.color = '#a5b4fc';
    }
}
