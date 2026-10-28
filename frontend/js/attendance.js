/**
 * MOBIXA - Attendance Module Controller
 */

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await requireAuth();
    if (!currentUser) return;

    // Show Admin-specific controls if role is admin
    if (currentUser.role === 'admin') {
        const adminSection = document.getElementById('adminAttendanceSection');
        if (adminSection) adminSection.style.display = 'block';
        loadAllAttendance();
    }

    loadTodayStatus();
    loadMyAttendance();
});

async function loadTodayStatus() {
    try {
        const res = await apiCall('/attendance/today');
        if (!res || !res.ok) return;

        const record = res.data.data;
        const statusBadge = document.getElementById('todayStatusBadge');
        const checkInTime = document.getElementById('todayCheckInTime');
        const checkOutTime = document.getElementById('todayCheckOutTime');
        const btnIn = document.getElementById('btnCheckIn');
        const btnOut = document.getElementById('btnCheckOut');

        if (!record) {
            if (statusBadge) statusBadge.innerHTML = '<span class="status cancelled">Not Checked In</span>';
            if (checkInTime) checkInTime.textContent = '--:--';
            if (checkOutTime) checkOutTime.textContent = '--:--';
            if (btnIn) btnIn.disabled = false;
            if (btnOut) btnOut.disabled = true;
        } else if (record.checkIn && !record.checkOut) {
            const inStr = new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (statusBadge) statusBadge.innerHTML = '<span class="status completed">Checked In (Active)</span>';
            if (checkInTime) checkInTime.textContent = inStr;
            if (checkOutTime) checkOutTime.textContent = 'In Progress...';
            if (btnIn) btnIn.disabled = true;
            if (btnOut) btnOut.disabled = false;
        } else {
            const inStr = new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const outStr = new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (statusBadge) statusBadge.innerHTML = '<span class="status completed">Shift Completed</span>';
            if (checkInTime) checkInTime.textContent = inStr;
            if (checkOutTime) checkOutTime.textContent = outStr;
            if (btnIn) btnIn.disabled = true;
            if (btnOut) btnOut.disabled = true;
        }
    } catch (e) {
        console.error('Attendance status error:', e);
    }
}

async function doCheckIn() {
    try {
        const res = await apiCall('/attendance/check-in', 'POST');
        if (res && res.ok) {
            showToast('Checked in successfully!', 'success');
            loadTodayStatus();
            loadMyAttendance();
            if (currentUser.role === 'admin') loadAllAttendance();
        } else {
            showToast(res ? res.data.message : 'Check in failed', 'error');
        }
    } catch (e) {
        showToast('Server communication error', 'error');
    }
}

async function doCheckOut() {
    if (!confirm('Confirm check-out for today?')) return;
    try {
        const res = await apiCall('/attendance/check-out', 'POST');
        if (res && res.ok) {
            showToast('Checked out successfully. Have a good evening!', 'success');
            loadTodayStatus();
            loadMyAttendance();
            if (currentUser.role === 'admin') loadAllAttendance();
        } else {
            showToast(res ? res.data.message : 'Check out failed', 'error');
        }
    } catch (e) {
        showToast('Server communication error', 'error');
    }
}

async function loadMyAttendance() {
    try {
        const res = await apiCall('/attendance/my');
        if (!res || !res.ok) return;

        const records = res.data.data || [];
        const tbody = document.getElementById('myAttendanceBody');
        if (!tbody) return;

        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">No attendance history found.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map(r => {
            const inTime = r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
            const outTime = r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';

            return `
                <tr>
                    <td style="font-weight:600; color:white;">${r.date}</td>
                    <td>${inTime}</td>
                    <td>${outTime}</td>
                    <td><span class="status completed">${r.status}</span></td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('My attendance error:', e);
    }
}

async function loadAllAttendance() {
    try {
        const dateInput = document.getElementById('adminAttendanceDate');
        const selectedDate = dateInput ? dateInput.value : '';

        const url = selectedDate ? `/attendance?date=${selectedDate}` : '/attendance?limit=50';
        const res = await apiCall(url);
        if (!res || !res.ok) return;

        const records = res.data.data || [];
        const tbody = document.getElementById('allAttendanceBody');
        if (!tbody) return;

        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:25px; color:#94a3b8;">No staff attendance logs found for this date.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map(r => {
            const empName = r.employee ? r.employee.name : 'Unknown Staff';
            const empRole = r.employee ? r.employee.designation || r.employee.role : '-';
            const inTime = r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
            const outTime = r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';

            return `
                <tr>
                    <td style="font-weight:600; color:white;">${empName}</td>
                    <td style="color:#94a3b8;"><small>${empRole}</small></td>
                    <td>${r.date}</td>
                    <td>${inTime}</td>
                    <td>${outTime}</td>
                    <td><span class="status completed">${r.status}</span></td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('All attendance error:', e);
    }
}
