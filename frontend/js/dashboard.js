/**
 * MOBIXA - Admin Dashboard Controller
 * Connects directly to backend API and MongoDB
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Auth Guard: Admin only
    const user = await requireAuth(['admin']);
    if (!user) return;

    loadDashboardData();
});

async function loadDashboardData() {
    try {
        const res = await apiCall('/dashboard/admin');
        if (!res || !res.ok) {
            showToast('Failed to load dashboard data', 'error');
            return;
        }

        const data = res.data.data;
        const metrics = data.metrics;

        // Populate summary cards
        setText('totalRevenueDisplay', formatCurrency(metrics.totalRevenue));
        setText('todayRevenueDisplay', formatCurrency(metrics.todayRevenue));
        setText('totalSalesDisplay', metrics.totalSalesCount || 0);
        setText('todaySalesDisplay', `${metrics.todaySalesCount || 0} today`);
        setText('totalProductsDisplay', metrics.totalProducts || 0);
        setText('totalCustomersDisplay', metrics.totalCustomers || 0);
        setText('totalEmployeesDisplay', metrics.totalEmployees || 0);
        setText('lowStockCountDisplay', metrics.lowStockCount || 0);

        // Render Recent Transactions
        renderRecentTransactions(data.recentTransactions || []);

        // Render Low Stock Items
        renderLowStock(data.lowStockItems || []);

        // Render Top Products if element exists
        if (document.getElementById('topProductsList')) {
            renderTopProducts(data.topProducts || []);
        }

    } catch (error) {
        console.error('Dashboard load error:', error);
        showToast('Error loading live dashboard metrics', 'error');
    }
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function renderRecentTransactions(transactions) {
    const tbody = document.getElementById('recentTransactionsBody');
    if (!tbody) return;

    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 25px; color:#94a3b8;">No transactions recorded yet. Create your first sale in the Sales module!</td></tr>`;
        return;
    }

    tbody.innerHTML = transactions.map(t => {
        const dateStr = formatDate(t.createdAt);
        const productsSummary = (t.items || []).map(i => `${i.name} (x${i.quantity})`).join(', ') || 'Item';
        const statusClass = t.saleStatus === 'Completed' ? 'completed' : 'cancelled';

        return `
            <tr>
                <td style="font-weight:600; color:#8b5cf6;">${t.invoiceNumber}</td>
                <td>${t.customerName}</td>
                <td><small style="color:#94a3b8;">${productsSummary}</small></td>
                <td style="font-weight:700;">${formatCurrency(t.grandTotal)}</td>
                <td><span class="badge ${t.paymentMethod.toLowerCase()}">${t.paymentMethod}</span></td>
                <td><span class="status ${statusClass}">${t.saleStatus}</span></td>
            </tr>
        `;
    }).join('');
}

function renderLowStock(items) {
    const container = document.getElementById('lowStockContainer');
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `<div style="padding: 20px; text-align: center; color: #10b981;">✓ All products are adequately stocked!</div>`;
        return;
    }

    container.innerHTML = items.map(p => {
        const isCritical = p.stock === 0;
        const badgeColor = isCritical ? '#ef4444' : '#f59e0b';
        const label = isCritical ? 'Out of Stock' : `${p.stock} left (Min: ${p.minStockLevel})`;

        return `
            <div class="stock-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; border-bottom:1px solid rgba(255,255,255,0.05);">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="font-size:22px;">📱</div>
                    <div>
                        <div style="font-weight:600; font-size:14px;">${p.name}</div>
                        <small style="color:#94a3b8;">${p.brand} • SKU: ${p.sku}</small>
                    </div>
                </div>
                <div>
                    <span style="background:${badgeColor}22; color:${badgeColor}; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:600;">
                        ${label}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

function renderTopProducts(topProducts) {
    const container = document.getElementById('topProductsList');
    if (!container) return;

    if (topProducts.length === 0) {
        container.innerHTML = `<div style="color:#94a3b8; font-size:13px;">No sales data available.</div>`;
        return;
    }

    container.innerHTML = topProducts.map((p, idx) => `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:8px 0; border-bottom:1px dashed rgba(255,255,255,0.05);">
            <div>
                <span style="color:#8b5cf6; font-weight:bold; margin-right:8px;">#${idx + 1}</span>
                <span style="font-weight:500;">${p.name}</span>
            </div>
            <div style="text-align:right;">
                <div style="font-weight:600; color:#10b981;">${formatCurrency(p.revenue)}</div>
                <small style="color:#94a3b8;">${p.units} units sold</small>
            </div>
        </div>
    `).join('');
}
