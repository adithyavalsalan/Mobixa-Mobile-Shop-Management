/**
 * MOBIXA - Employee Dashboard Controller
 * Connects authenticated employee with live MongoDB sales & attendance
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Auth Guard: Employee (or Admin testing employee view)
    const user = await requireAuth(['employee', 'admin']);
    if (!user) return;

    loadEmployeeDashboard();
    checkTodayAttendance();
});

async function loadEmployeeDashboard() {
    try {
        const res = await apiCall('/dashboard/employee');
        if (!res || !res.ok) {
            showToast('Failed to load employee metrics', 'error');
            return;
        }

        const data = res.data.data;
        const metrics = data.metrics;

        // Set metrics
        setText('empTodaySalesDisplay', metrics.todaySalesCount || 0);
        setText('empTodayRevenueDisplay', formatCurrency(metrics.todayRevenue));
        setText('empLifetimeSalesDisplay', metrics.lifetimeSalesCount || 0);
        setText('empLifetimeRevenueDisplay', formatCurrency(metrics.lifetimeRevenue));
        setText('empAvailableProductsDisplay', metrics.availableProductsCount || 0);

        // Render Recent Sales
        renderEmployeeRecentSales(data.recentSales || []);

        // Attendance state
        updateAttendanceUI(data.attendance);

    } catch (error) {
        console.error('Employee dashboard error:', error);
        showToast('Error loading live performance', 'error');
    }
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function renderEmployeeRecentSales(sales) {
    const tbody = document.getElementById('empRecentSalesBody');
    if (!tbody) return;

    if (sales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 25px; color:#94a3b8;">No sales recorded by you yet today. Click 'New Sale' to begin!</td></tr>`;
        return;
    }

    tbody.innerHTML = sales.map(s => {
        const items = (s.items || []).map(i => `${escapeHtml(i.name)} (x${i.quantity})`).join(', ');
        return `
            <tr>
                <td style="font-weight:600; color:#8b5cf6;">${escapeHtml(s.invoiceNumber)}</td>
                <td>${escapeHtml(s.customerName)}</td>
                <td><small style="color:#94a3b8;">${items}</small></td>
                <td style="font-weight:700;">${formatCurrency(s.grandTotal)}</td>
                <td><span class="status ${s.saleStatus === 'Completed' ? 'completed' : 'cancelled'}">${escapeHtml(s.saleStatus)}</span></td>
            </tr>
        `;
    }).join('');
}

async function checkTodayAttendance() {
    try {
        const res = await apiCall('/attendance/today');
        if (res && res.ok) {
            updateAttendanceUI(res.data.data);
        }
    } catch (e) {
        console.error('Attendance check error:', e);
    }
}

function updateAttendanceUI(record) {
    const statusText = document.getElementById('attendanceStatusText');
    const checkInBtn = document.getElementById('checkInBtn');
    const checkOutBtn = document.getElementById('checkOutBtn');

    if (!record) {
        if (statusText) statusText.innerHTML = `<span style="color:#ef4444;">● Not Checked In Today</span>`;
        if (checkInBtn) checkInBtn.disabled = false;
        if (checkOutBtn) checkOutBtn.disabled = true;
    } else if (record.checkIn && !record.checkOut) {
        const time = new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (statusText) statusText.innerHTML = `<span style="color:#10b981;">● Checked In at ${time} (Active)</span>`;
        if (checkInBtn) checkInBtn.disabled = true;
        if (checkOutBtn) checkOutBtn.disabled = false;
    } else {
        const inTime = new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const outTime = new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (statusText) statusText.innerHTML = `<span style="color:#6366f1;">✓ Completed Shift (${inTime} – ${outTime})</span>`;
        if (checkInBtn) checkInBtn.disabled = true;
        if (checkOutBtn) checkOutBtn.disabled = true;
    }
}

async function handleCheckIn() {
    const res = await apiCall('/attendance/check-in', 'POST');
    if (res && res.ok) {
        showToast('Checked in successfully!', 'success');
        checkTodayAttendance();
    } else {
        showToast(res ? res.data.message : 'Check-in failed', 'error');
    }
}

async function handleCheckOut() {
    if (!confirm('Are you sure you want to check out for today?')) return;
    const res = await apiCall('/attendance/check-out', 'POST');
    if (res && res.ok) {
        showToast('Checked out successfully. Have a great day!', 'success');
        checkTodayAttendance();
    } else {
        showToast(res ? res.data.message : 'Check-out failed', 'error');
    }
}
