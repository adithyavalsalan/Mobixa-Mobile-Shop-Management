/**
 * MOBIXA - Employee Management Controller
 * Fully integrated with MongoDB User accounts & permissions
 */

let allEmployees = [];
let currentEditingEmpId = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Only Admin can manage employees
    const user = await requireAuth(['admin']);
    if (!user) return;

    loadEmployees();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => filterEmployeesTable());
    }

    const roleFilter = document.getElementById('roleFilter');
    if (roleFilter) {
        roleFilter.addEventListener('change', () => filterEmployeesTable());
    }

    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', () => filterEmployeesTable());
    }

    const form = document.getElementById('employeeForm');
    if (form) {
        form.addEventListener('submit', handleEmployeeSubmit);
    }
});

async function loadEmployees() {
    try {
        const res = await apiCall('/employees');
        if (!res || !res.ok) {
            showToast('Failed to load employee list', 'error');
            return;
        }

        allEmployees = res.data.data || [];
        const summary = res.data.summary || {};

        setText('totalEmployeesDisplay', summary.totalEmployees || allEmployees.length);
        setText('activeEmployeesDisplay', summary.activeCount || 0);
        setText('adminCountDisplay', summary.adminCount || 0);

        filterEmployeesTable();
    } catch (e) {
        console.error('Employees load error:', e);
        showToast('Error loading employees', 'error');
    }
}

function filterEmployeesTable() {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const role = document.getElementById('roleFilter')?.value || 'all';
    const status = document.getElementById('statusFilter')?.value || 'all';

    const filtered = allEmployees.filter(emp => {
        const matchSearch = !search ||
            emp.name.toLowerCase().includes(search) ||
            emp.email.toLowerCase().includes(search) ||
            (emp.phone && emp.phone.includes(search)) ||
            (emp.designation && emp.designation.toLowerCase().includes(search));

        const matchRole = (role === 'all') || (emp.role && emp.role.toLowerCase() === role.toLowerCase());
        const matchStatus = (status === 'all') || (emp.status && emp.status.toLowerCase() === status.toLowerCase());

        return matchSearch && matchRole && matchStatus;
    });

    renderEmployeeTable(filtered);
}

function renderEmployeeTable(employees) {
    const tbody = document.getElementById('employeeTableBody');
    if (!tbody) return;

    if (employees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#94a3b8;">No matching employee records.</td></tr>`;
        return;
    }

    tbody.innerHTML = employees.map(emp => {
        const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'E';
        const roleBadge = emp.role === 'admin'
            ? '<span class="badge" style="background:rgba(139,92,246,0.2); color:#c4b5fd;">👑 Administrator</span>'
            : '<span class="badge" style="background:rgba(99,102,241,0.15); color:#a5b4fc;">Staff Employee</span>';

        const statusBadge = emp.status === 'active'
            ? '<span class="status completed">Active</span>'
            : '<span class="status cancelled">Inactive</span>';

        const joinDate = formatDate(emp.joiningDate || emp.createdAt);

        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg, #6366f1, #8b5cf6); color:white; font-weight:bold; display:flex; align-items:center; justify-content:center; font-size:12px;">
                            ${initials}
                        </div>
                        <div>
                            <div style="font-weight:600; color:white;">${emp.name}</div>
                            <small style="color:#94a3b8;">${emp.designation || 'Staff'}</small>
                        </div>
                    </div>
                </td>
                <td style="color:#cbd5e1;">${emp.email}</td>
                <td style="color:#a5b4fc;">${emp.phone || '-'}</td>
                <td>${roleBadge}</td>
                <td>₹${Number(emp.salary || 0).toLocaleString()}</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button class="action-btn" onclick="openEditEmployeeModal('${emp._id}')" title="Edit Employee">✏️</button>
                        <button class="action-btn" onclick="viewEmployeePerformance('${emp._id}')" title="Sales & Performance">📈 View</button>
                        <button class="action-btn delete-btn" onclick="deleteEmployeeById('${emp._id}', '${emp.name}')" title="Delete Account">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openAddEmployeeModal() {
    currentEditingEmpId = null;
    const form = document.getElementById('employeeForm');
    if (form) form.reset();
    setText('employeeModalTitle', 'Add New Employee Account');
    document.getElementById('empPasswordGroup').style.display = 'block';
    document.getElementById('empPassword').required = true;
    document.getElementById('employeeModal').classList.add('show');
}

function openEditEmployeeModal(id) {
    currentEditingEmpId = id;
    const emp = allEmployees.find(item => item._id === id);
    if (!emp) return;

    setText('employeeModalTitle', 'Edit Employee Account');
    setVal('empName', emp.name);
    setVal('empEmail', emp.email);
    setVal('empPhone', emp.phone || '');
    setVal('empRole', emp.role || 'employee');
    setVal('empDesignation', emp.designation || 'Sales Executive');
    setVal('empSalary', emp.salary || 0);
    setVal('empStatus', emp.status || 'active');

    // Password is optional when editing
    document.getElementById('empPassword').required = false;
    document.getElementById('empPassword').value = '';
    document.getElementById('empPasswordGroup').style.display = 'block';
    document.getElementById('empPasswordLabel').textContent = 'New Password (Leave blank to keep unchanged)';

    document.getElementById('employeeModal').classList.add('show');
}

function closeEmployeeModal() {
    document.getElementById('employeeModal').classList.remove('show');
    currentEditingEmpId = null;
}

async function handleEmployeeSubmit(e) {
    e.preventDefault();

    const name = getVal('empName');
    const email = getVal('empEmail');
    const phone = getVal('empPhone');
    const role = getVal('empRole');
    const designation = getVal('empDesignation');
    const salary = Number(getVal('empSalary')) || 0;
    const status = getVal('empStatus');
    const password = document.getElementById('empPassword').value.trim();

    const payload = { name, email, phone, role, designation, salary, status };
    if (password) {
        payload.password = password;
    }

    try {
        let res;
        if (currentEditingEmpId) {
            res = await apiCall(`/employees/${currentEditingEmpId}`, 'PUT', payload);
        } else {
            if (!password) {
                showToast('Password is required for new accounts', 'error');
                return;
            }
            res = await apiCall('/employees', 'POST', payload);
        }

        if (res && res.ok) {
            showToast(res.data.message || 'Employee account saved!', 'success');
            closeEmployeeModal();
            loadEmployees();
        } else {
            showToast(res ? res.data.message : 'Error saving employee account', 'error');
        }
    } catch (err) {
        showToast('Server communication error', 'error');
    }
}

async function deleteEmployeeById(id, name) {
    if (!confirm(`Are you sure you want to remove '${name}'?`)) return;

    try {
        const res = await apiCall(`/employees/${id}`, 'DELETE');
        if (res && res.ok) {
            showToast(res.data.message || 'Employee removed successfully', 'success');
            loadEmployees();
        } else {
            showToast(res ? res.data.message : 'Cannot remove employee', 'error');
        }
    } catch (e) {
        showToast('Server error processing deletion', 'error');
    }
}

async function viewEmployeePerformance(id) {
    try {
        const res = await apiCall(`/employees/${id}`);
        if (!res || !res.ok) {
            showToast('Unable to load employee stats', 'error');
            return;
        }

        const data = res.data.data;
        const emp = data.employee;
        const stats = data.stats || {};
        const recentSales = data.recentSales || [];

        setText('perfName', emp.name);
        setText('perfRole', `${emp.designation || 'Staff'} • ${emp.role.toUpperCase()}`);
        setText('perfTotalSales', stats.totalSalesCount || 0);
        setText('perfTotalRevenue', formatCurrency(stats.totalSalesAmount || 0));

        const list = document.getElementById('perfSalesList');
        if (list) {
            if (recentSales.length === 0) {
                list.innerHTML = `<div style="padding:15px; text-align:center; color:#94a3b8;">No sales closed by this employee yet.</div>`;
            } else {
                list.innerHTML = recentSales.map(s => `
                    <div style="background:#0b0f1d; padding:8px 12px; border-radius:8px; margin-bottom:6px; font-size:12px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <span style="font-weight:bold; color:#8b5cf6;">${s.invoiceNumber}</span>
                            <small style="color:#94a3b8; margin-left:6px;">${s.customerName}</small>
                        </div>
                        <span style="font-weight:bold; color:#10b981;">${formatCurrency(s.grandTotal)}</span>
                    </div>
                `).join('');
            }
        }

        document.getElementById('performanceModal').classList.add('show');
    } catch (e) {
        showToast('Error loading performance details', 'error');
    }
}

function closePerformanceModal() {
    document.getElementById('performanceModal').classList.remove('show');
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
