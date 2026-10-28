/**
 * MOBIXA - Customer Management Controller
 * Fully integrated with MongoDB backend
 */

let allCustomers = [];
let currentEditingCustomerId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireAuth();
    if (!user) return;

    loadCustomers();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => filterCustomersTable());
    }

    const form = document.getElementById('customerForm');
    if (form) {
        form.addEventListener('submit', handleCustomerSubmit);
    }
});

async function loadCustomers() {
    try {
        const res = await apiCall('/customers');
        if (!res || !res.ok) {
            showToast('Failed to load customers', 'error');
            return;
        }

        allCustomers = res.data.data || [];
        const summary = res.data.summary || {};

        setText('totalCustomersDisplay', summary.totalCustomers || allCustomers.length);
        setText('totalCustomerSpendDisplay', formatCurrency(summary.totalRevenueFromCustomers || 0));

        filterCustomersTable();
    } catch (e) {
        console.error('Customer load error:', e);
        showToast('Error loading customer records', 'error');
    }
}

function filterCustomersTable() {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

    const filtered = allCustomers.filter(c => {
        return !search ||
            c.name.toLowerCase().includes(search) ||
            c.phone.includes(search) ||
            (c.email && c.email.toLowerCase().includes(search)) ||
            (c.address && c.address.toLowerCase().includes(search));
    });

    renderCustomerTable(filtered);
}

function renderCustomerTable(customers) {
    const tbody = document.getElementById('customerTableBody');
    if (!tbody) return;

    if (customers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8;">No customer profiles found.</td></tr>`;
        return;
    }

    tbody.innerHTML = customers.map(c => {
        const initials = c.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'C';

        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:34px; height:34px; border-radius:50%; background:rgba(99,102,241,0.2); color:#818cf8; font-weight:bold; display:flex; align-items:center; justify-content:center; font-size:12px;">
                            ${initials}
                        </div>
                        <div>
                            <div style="font-weight:600; color:white;">${c.name}</div>
                            <small style="color:#94a3b8;">${c.email || 'No email'}</small>
                        </div>
                    </div>
                </td>
                <td style="color:#a5b4fc; font-weight:500;">${c.phone}</td>
                <td style="color:#cbd5e1;"><small>${c.address || '-'}</small></td>
                <td style="font-weight:bold;">${c.totalPurchases || 0}</td>
                <td style="font-weight:700; color:#10b981;">${formatCurrency(c.totalSpent || 0)}</td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button class="action-btn" onclick="openEditCustomerModal('${c._id}')" title="Edit Profile">✏️</button>
                        <button class="action-btn" onclick="viewCustomerHistory('${c._id}')" title="Purchase History">🛍️ History</button>
                        <button class="action-btn delete-btn" onclick="deleteCustomerById('${c._id}', '${c.name}')" title="Delete Profile">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openAddCustomerModal() {
    currentEditingCustomerId = null;
    const form = document.getElementById('customerForm');
    if (form) form.reset();
    setText('customerModalTitle', 'Add New Customer Profile');
    document.getElementById('customerModal').classList.add('show');
}

function openEditCustomerModal(id) {
    currentEditingCustomerId = id;
    const c = allCustomers.find(item => item._id === id);
    if (!c) return;

    setText('customerModalTitle', 'Edit Customer Profile');
    setVal('custName', c.name);
    setVal('custPhone', c.phone);
    setVal('custEmail', c.email || '');
    setVal('custAddress', c.address || '');
    setVal('custNotes', c.notes || '');

    document.getElementById('customerModal').classList.add('show');
}

function closeCustomerModal() {
    document.getElementById('customerModal').classList.remove('show');
    currentEditingCustomerId = null;
}

async function handleCustomerSubmit(e) {
    e.preventDefault();

    const name = getVal('custName');
    const phone = getVal('custPhone');
    const email = getVal('custEmail');
    const address = getVal('custAddress');
    const notes = getVal('custNotes');

    const payload = { name, phone, email, address, notes };

    try {
        let res;
        if (currentEditingCustomerId) {
            res = await apiCall(`/customers/${currentEditingCustomerId}`, 'PUT', payload);
        } else {
            res = await apiCall('/customers', 'POST', payload);
        }

        if (res && res.ok) {
            showToast(res.data.message || 'Customer saved successfully!', 'success');
            closeCustomerModal();
            loadCustomers();
        } else {
            showToast(res ? res.data.message : 'Error saving customer', 'error');
        }
    } catch (err) {
        showToast('Server communication error', 'error');
    }
}

async function deleteCustomerById(id, name) {
    if (!confirm(`Are you sure you want to delete profile for '${name}'?`)) return;

    try {
        const res = await apiCall(`/customers/${id}`, 'DELETE');
        if (res && res.ok) {
            showToast(res.data.message || 'Customer deleted successfully', 'success');
            loadCustomers();
        } else {
            showToast(res ? res.data.message : 'Cannot delete customer', 'error');
        }
    } catch (e) {
        showToast('Error communicating with server', 'error');
    }
}

async function viewCustomerHistory(id) {
    try {
        const res = await apiCall(`/customers/${id}`);
        if (!res || !res.ok) {
            showToast('Unable to fetch history', 'error');
            return;
        }

        const customer = res.data.data.customer;
        const history = res.data.data.purchaseHistory || [];

        setText('historyCustomerName', customer.name);
        setText('historyCustomerPhone', customer.phone);
        setText('historyTotalSpent', formatCurrency(customer.totalSpent || 0));

        const list = document.getElementById('customerSalesHistoryList');
        if (list) {
            if (history.length === 0) {
                list.innerHTML = `<div style="padding:15px; text-align:center; color:#94a3b8;">No recorded sales transactions for this customer.</div>`;
            } else {
                list.innerHTML = history.map(s => `
                    <div style="background:#0b0f1d; padding:10px 14px; border-radius:8px; margin-bottom:8px; font-size:13px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <span style="font-weight:700; color:#8b5cf6;">${s.invoiceNumber}</span>
                            <small style="color:#94a3b8; margin-left:8px;">${formatDate(s.createdAt)}</small>
                            <div style="color:#cbd5e1; font-size:12px; margin-top:2px;">
                                ${(s.items || []).map(i => `${i.name} (x${i.quantity})`).join(', ')}
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-weight:bold; color:#10b981;">${formatCurrency(s.grandTotal)}</div>
                            <span class="status ${s.saleStatus === 'Completed' ? 'completed' : 'cancelled'}" style="font-size:10px; padding:2px 6px;">${s.saleStatus}</span>
                        </div>
                    </div>
                `).join('');
            }
        }

        document.getElementById('historyModal').classList.add('show');
    } catch (e) {
        showToast('Error fetching customer purchase details', 'error');
    }
}

function closeHistoryModal() {
    document.getElementById('historyModal').classList.remove('show');
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
}
