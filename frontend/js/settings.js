/**
 * MOBIXA - Settings & Configuration Controller
 */

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await requireAuth();
    if (!currentUser) return;

    // Populate user profile info
    setVal('profName', currentUser.name);
    setVal('profEmail', currentUser.email);
    setVal('profPhone', currentUser.phone || '');
    setVal('profRole', currentUser.role ? currentUser.role.toUpperCase() : 'STAFF');

    // If Admin, show store settings tab and load store config
    if (currentUser.role === 'admin') {
        const storeTabBtn = document.getElementById('tabBtnStore');
        if (storeTabBtn) storeTabBtn.style.display = 'inline-block';
        loadStoreSettings();
    }

    // Attach form listeners
    document.getElementById('profileForm')?.addEventListener('submit', handleProfileUpdate);
    document.getElementById('passwordForm')?.addEventListener('submit', handlePasswordChange);
    document.getElementById('storeSettingsForm')?.addEventListener('submit', handleStoreSettingsUpdate);
});

function switchTab(tabId) {
    document.querySelectorAll('.settings-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');

    const activeBtn = document.getElementById(`tabBtn${capitalize(tabId)}`);
    const activeContent = document.getElementById(`tabContent${capitalize(tabId)}`);

    if (activeBtn) activeBtn.classList.add('active');
    if (activeContent) activeContent.style.display = 'block';
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const name = getVal('profName');
    const phone = getVal('profPhone');

    try {
        const res = await apiCall('/auth/profile', 'PUT', { name, phone });
        if (res && res.ok) {
            showToast('Profile updated successfully!', 'success');
            // update local user
            currentUser.name = name;
            currentUser.phone = phone;
            localStorage.setItem('mobixa_user', JSON.stringify(currentUser));
        } else {
            showToast(res ? res.data.message : 'Error updating profile', 'error');
        }
    } catch (err) {
        showToast('Server communication error', 'error');
    }
}

async function handlePasswordChange(e) {
    e.preventDefault();
    const currentPassword = getVal('currentPassword');
    const newPassword = getVal('newPassword');
    const confirmPassword = getVal('confirmPassword');

    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match!', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters long', 'error');
        return;
    }

    try {
        const res = await apiCall('/auth/change-password', 'PUT', { currentPassword, newPassword });
        if (res && res.ok) {
            showToast('Password changed successfully!', 'success');
            document.getElementById('passwordForm').reset();
        } else {
            showToast(res ? res.data.message : 'Error changing password', 'error');
        }
    } catch (err) {
        showToast('Server error changing password', 'error');
    }
}

async function loadStoreSettings() {
    try {
        const res = await apiCall('/settings');
        if (!res || !res.ok) return;

        const s = res.data.data;
        setVal('storeName', s.shopName || '');
        setVal('storeTagline', s.tagline || '');
        setVal('storePhone', s.phone || '');
        setVal('storeEmail', s.email || '');
        setVal('storeAddress', s.address || '');
        setVal('storeCurrency', s.currency || '₹');
        setVal('storeTaxRate', s.defaultTaxRate !== undefined ? s.defaultTaxRate : 18);
        setVal('storeInvoicePrefix', s.invoicePrefix || 'MOB');
        setVal('storeFooter', s.invoiceFooter || '');
    } catch (e) {
        console.error('Settings load error:', e);
    }
}

async function handleStoreSettingsUpdate(e) {
    e.preventDefault();

    const payload = {
        shopName: getVal('storeName'),
        tagline: getVal('storeTagline'),
        phone: getVal('storePhone'),
        email: getVal('storeEmail'),
        address: getVal('storeAddress'),
        currency: getVal('storeCurrency'),
        defaultTaxRate: Number(getVal('storeTaxRate')),
        invoicePrefix: getVal('storeInvoicePrefix'),
        invoiceFooter: getVal('storeFooter')
    };

    try {
        const res = await apiCall('/settings', 'PUT', payload);
        if (res && res.ok) {
            showToast('Shop configuration saved successfully!', 'success');
        } else {
            showToast(res ? res.data.message : 'Failed to update store settings', 'error');
        }
    } catch (err) {
        showToast('Server communication error', 'error');
    }
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
}
