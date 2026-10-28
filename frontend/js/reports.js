/**
 * MOBIXA - Reports Controller
 * Aggregates live MongoDB sales, inventory, and profit data
 */

let currentReportData = null;

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireAuth(['admin']);
    if (!user) return;

    // Set default dates: past 30 days to today
    const toDateInput = document.getElementById('toDate');
    const fromDateInput = document.getElementById('fromDate');

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    if (toDateInput) toDateInput.value = today.toISOString().slice(0, 10);
    if (fromDateInput) fromDateInput.value = thirtyDaysAgo.toISOString().slice(0, 10);

    generateReport();
});

async function generateReport() {
    const reportType = document.getElementById('reportType')?.value || 'sales';
    const startDate = document.getElementById('fromDate')?.value || '';
    const endDate = document.getElementById('toDate')?.value || '';

    let url = `/reports/generate?reportType=${reportType}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;

    try {
        const res = await apiCall(url);
        if (!res || !res.ok) {
            showToast('Failed to generate report', 'error');
            return;
        }

        currentReportData = res.data;
        renderReportView(currentReportData);
    } catch (e) {
        console.error('Report error:', e);
        showToast('Error generating report metrics', 'error');
    }
}

function renderReportView(report) {
    const summaryContainer = document.getElementById('reportSummaryBox');
    const tableHeader = document.getElementById('reportTableHead');
    const tableBody = document.getElementById('reportTableBody');

    if (!summaryContainer || !tableHeader || !tableBody) return;

    if (report.reportType === 'inventory') {
        const sum = report.summary || {};
        summaryContainer.innerHTML = `
            <div class="report-stat"><small>TOTAL PRODUCTS</small><strong>${sum.totalProducts}</strong></div>
            <div class="report-stat"><small>TOTAL STOCK UNITS</small><strong>${sum.totalStock}</strong></div>
            <div class="report-stat"><small>COST VALUATION</small><strong>${formatCurrency(sum.totalValuation)}</strong></div>
            <div class="report-stat"><small>POTENTIAL RETAIL</small><strong>${formatCurrency(sum.potentialRetailValue)}</strong></div>
            <div class="report-stat"><small>EST. GROSS MARGIN</small><strong style="color:#10b981;">${formatCurrency(sum.estimatedMargin)}</strong></div>
        `;

        tableHeader.innerHTML = `
            <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Purchase Cost</th>
                <th>Selling Price</th>
                <th>In Stock</th>
                <th>Total Value (Cost)</th>
            </tr>
        `;

        tableBody.innerHTML = (report.data || []).map(p => `
            <tr>
                <td style="font-weight:600; color:white;">${p.name} <small style="color:#94a3b8;">(${p.brand})</small></td>
                <td style="font-family:monospace; color:#a5b4fc;">${p.sku}</td>
                <td>${p.category}</td>
                <td>${formatCurrency(p.purchaseCost)}</td>
                <td style="color:#10b981; font-weight:600;">${formatCurrency(p.sellingPrice)}</td>
                <td style="font-weight:bold;">${p.stock}</td>
                <td style="font-weight:bold; color:white;">${formatCurrency(p.purchaseCost * p.stock)}</td>
            </tr>
        `).join('');

    } else if (report.reportType === 'customers') {
        const sum = report.summary || {};
        summaryContainer.innerHTML = `
            <div class="report-stat"><small>REGISTERED CLIENTS</small><strong>${sum.totalCustomers}</strong></div>
            <div class="report-stat"><small>CUMULATIVE SALES</small><strong style="color:#10b981;">${formatCurrency(sum.totalSpent)}</strong></div>
        `;

        tableHeader.innerHTML = `
            <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Total Orders</th>
                <th>Total Spend</th>
            </tr>
        `;

        tableBody.innerHTML = (report.data || []).map(c => `
            <tr>
                <td style="font-weight:600; color:white;">${c.name}</td>
                <td>${c.phone}</td>
                <td>${c.email || '-'}</td>
                <td style="font-weight:bold;">${c.totalPurchases || 0}</td>
                <td style="font-weight:bold; color:#10b981;">${formatCurrency(c.totalSpent || 0)}</td>
            </tr>
        `).join('');

    } else if (report.reportType === 'employees') {
        summaryContainer.innerHTML = `
            <div class="report-stat"><small>ACTIVE SALES STAFF</small><strong>${(report.data || []).length}</strong></div>
        `;

        tableHeader.innerHTML = `
            <tr>
                <th>Staff Member</th>
                <th>Designation</th>
                <th>Role</th>
                <th>Total Bills Closed</th>
                <th>Total Revenue Generated</th>
            </tr>
        `;

        tableBody.innerHTML = (report.data || []).map(e => `
            <tr>
                <td style="font-weight:600; color:white;">${e.name}</td>
                <td>${e.designation || 'Staff'}</td>
                <td><span class="badge ${e.role}">${e.role.toUpperCase()}</span></td>
                <td style="font-weight:bold;">${e.salesCount}</td>
                <td style="font-weight:bold; color:#10b981;">${formatCurrency(e.totalRevenue)}</td>
            </tr>
        `).join('');

    } else {
        // Sales & Profit Report
        const sum = report.summary || {};
        summaryContainer.innerHTML = `
            <div class="report-stat"><small>TRANSACTIONS</small><strong>${sum.completedTransactions}</strong></div>
            <div class="report-stat"><small>GROSS SALES</small><strong>${formatCurrency(sum.grossSubtotal)}</strong></div>
            <div class="report-stat"><small>DISCOUNTS</small><strong style="color:#f59e0b;">- ${formatCurrency(sum.totalDiscount)}</strong></div>
            <div class="report-stat"><small>NET REVENUE</small><strong style="color:#10b981;">${formatCurrency(sum.netRevenue)}</strong></div>
            <div class="report-stat"><small>EST. GROSS PROFIT</small><strong style="color:#38bdf8;">${formatCurrency(sum.grossProfit)}</strong></div>
        `;

        tableHeader.innerHTML = `
            <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Sold By</th>
                <th>Payment</th>
                <th>Subtotal</th>
                <th>Grand Total</th>
                <th>Status</th>
            </tr>
        `;

        tableBody.innerHTML = (report.data || []).map(s => `
            <tr>
                <td style="font-weight:700; color:#8b5cf6;">${s.invoiceNumber}</td>
                <td style="color:#94a3b8;">${formatDate(s.createdAt)}</td>
                <td style="font-weight:500;">${s.customerName}</td>
                <td>${s.soldBy ? s.soldBy.name : 'Staff'}</td>
                <td><span class="badge ${s.paymentMethod.toLowerCase()}">${s.paymentMethod}</span></td>
                <td>${formatCurrency(s.subtotal)}</td>
                <td style="font-weight:bold; color:#10b981;">${formatCurrency(s.grandTotal)}</td>
                <td><span class="status ${s.saleStatus === 'Completed' ? 'completed' : 'cancelled'}">${s.saleStatus}</span></td>
            </tr>
        `).join('');
    }
}

function exportReport() {
    const reportType = document.getElementById('reportType')?.value || 'sales';
    const startDate = document.getElementById('fromDate')?.value || '';
    const endDate = document.getElementById('toDate')?.value || '';

    let url = `/api/reports/export-csv?reportType=${reportType}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;

    window.open(url, '_blank');
}

function printReport() {
    window.print();
}
