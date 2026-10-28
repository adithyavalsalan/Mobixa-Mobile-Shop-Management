/**
 * MOBIXA - Inventory Management Controller
 * Handles live stock levels, stock-in replenishment, stock adjustments & audit movements
 */

let inventoryList = [];

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireAuth();
    if (!user) return;

    loadInventory();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => filterInventoryTable());
    }

    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => filterInventoryTable());
    }

    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', () => filterInventoryTable());
    }

    const stockInForm = document.getElementById('stockInForm');
    if (stockInForm) {
        stockInForm.addEventListener('submit', handleStockInSubmit);
    }

    const adjustForm = document.getElementById('adjustForm');
    if (adjustForm) {
        adjustForm.addEventListener('submit', handleAdjustSubmit);
    }
});

async function loadInventory() {
    try {
        const res = await apiCall('/inventory');
        if (!res || !res.ok) {
            showToast('Failed to load inventory', 'error');
            return;
        }

        inventoryList = res.data.data || [];
        const summary = res.data.summary || {};

        setText('totalUnitsDisplay', summary.totalUnits || 0);
        setText('totalProductsDisplay', summary.totalProducts || 0);
        setText('lowStockDisplay', summary.lowStockCount || 0);
        setText('outOfStockDisplay', summary.outOfStockCount || 0);

        // Populate product select dropdowns
        populateProductDropdowns();

        filterInventoryTable();
    } catch (e) {
        console.error('Inventory error:', e);
        showToast('Error fetching inventory data', 'error');
    }
}

function populateProductDropdowns() {
    const stockInSelect = document.getElementById('stockInProduct');
    const adjustSelect = document.getElementById('adjustProduct');

    const optionsHtml = '<option value="">-- Choose Product --</option>' +
        inventoryList.map(p => `<option value="${p._id}">${p.name} (SKU: ${p.sku}) [Current: ${p.stock}]</option>`).join('');

    if (stockInSelect) stockInSelect.innerHTML = optionsHtml;
    if (adjustSelect) adjustSelect.innerHTML = optionsHtml;
}

function filterInventoryTable() {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const category = document.getElementById('categoryFilter')?.value || 'all';
    const status = document.getElementById('statusFilter')?.value || 'all';

    const filtered = inventoryList.filter(p => {
        const matchSearch = !search ||
            p.name.toLowerCase().includes(search) ||
            p.brand.toLowerCase().includes(search) ||
            p.sku.toLowerCase().includes(search);

        const matchCat = (category === 'all') || (p.category && p.category.toLowerCase() === category.toLowerCase());

        let matchStatus = true;
        if (status === 'in') matchStatus = p.stock > p.minStockLevel;
        else if (status === 'low') matchStatus = p.stock > 0 && p.stock <= p.minStockLevel;
        else if (status === 'out') matchStatus = p.stock === 0;

        return matchSearch && matchCat && matchStatus;
    });

    renderInventoryTable(filtered);
}

function renderInventoryTable(products) {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;

    if (products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#94a3b8;">No matching inventory records.</td></tr>`;
        return;
    }

    tbody.innerHTML = products.map(p => {
        let statusBadge = '<span class="status in">In Stock</span>';
        let stockStyle = 'color:#10b981; font-weight:700;';

        if (p.stock === 0) {
            statusBadge = '<span class="status out">Out of Stock</span>';
            stockStyle = 'color:#ef4444; font-weight:700;';
        } else if (p.stock <= p.minStockLevel) {
            statusBadge = '<span class="status low">Low Stock</span>';
            stockStyle = 'color:#f59e0b; font-weight:700;';
        }

        const imeisCount = p.imeiList ? p.imeiList.length : 0;

        return `
            <tr>
                <td>
                    <div style="font-weight:600; color:white;">${p.name}</div>
                    <small style="color:#94a3b8;">${p.brand} ${p.modelName ? '• ' + p.modelName : ''}</small>
                </td>
                <td style="font-family:monospace; color:#a5b4fc;">${p.sku}</td>
                <td><span class="category-badge">${p.category}</span></td>
                <td style="${stockStyle}">${p.stock} units</td>
                <td style="color:#94a3b8;">${p.minStockLevel}</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button class="action-btn" onclick="openStockInForProduct('${p._id}')" title="Quick Stock In">📥 Add Stock</button>
                        <button class="action-btn" onclick="openAdjustForProduct('${p._id}')" title="Adjust Stock">⚖️ Adjust</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Modal open/close helpers
function openStockInModal() {
    const form = document.getElementById('stockInForm');
    if (form) form.reset();
    document.getElementById('stockInModal').classList.add('show');
}

function openStockInForProduct(id) {
    openStockInModal();
    const select = document.getElementById('stockInProduct');
    if (select) select.value = id;
}

function closeStockInModal() {
    document.getElementById('stockInModal').classList.remove('show');
}

function openAdjustModal() {
    const form = document.getElementById('adjustForm');
    if (form) form.reset();
    document.getElementById('adjustModal').classList.add('show');
}

function openAdjustForProduct(id) {
    openAdjustModal();
    const select = document.getElementById('adjustProduct');
    if (select) {
        select.value = id;
        onAdjustProductSelect();
    }
}

function onAdjustProductSelect() {
    const select = document.getElementById('adjustProduct');
    const p = inventoryList.find(i => i._id === select.value);
    const currSpan = document.getElementById('adjustCurrentStock');
    if (currSpan) {
        currSpan.textContent = p ? `${p.stock} units` : '-';
    }
}

function closeAdjustModal() {
    document.getElementById('adjustModal').classList.remove('show');
}

async function handleStockInSubmit(e) {
    e.preventDefault();
    const productId = document.getElementById('stockInProduct').value;
    const quantity = Number(document.getElementById('stockInQty').value);
    const reason = document.getElementById('stockInReason').value.trim();
    const reference = document.getElementById('stockInRef').value.trim();
    const imeiStr = document.getElementById('stockInImeis').value.trim();

    const imeis = imeiStr ? imeiStr.split(',').map(s => s.trim()).filter(Boolean) : [];

    if (!productId || isNaN(quantity) || quantity <= 0) {
        showToast('Please select product and enter quantity > 0', 'error');
        return;
    }

    try {
        const res = await apiCall('/inventory/stock-in', 'POST', {
            productId,
            quantity,
            reason,
            reference,
            imeis
        });

        if (res && res.ok) {
            showToast(res.data.message || 'Stock added successfully!', 'success');
            closeStockInModal();
            loadInventory();
        } else {
            showToast(res ? res.data.message : 'Error adding stock', 'error');
        }
    } catch (err) {
        showToast('Server communication error', 'error');
    }
}

async function handleAdjustSubmit(e) {
    e.preventDefault();
    const productId = document.getElementById('adjustProduct').value;
    const newQuantity = Number(document.getElementById('adjustNewQty').value);
    const reason = document.getElementById('adjustReason').value.trim();

    if (!productId || isNaN(newQuantity) || newQuantity < 0) {
        showToast('Please select product and valid non-negative target stock', 'error');
        return;
    }

    if (!reason) {
        showToast('Please provide an audit reason for adjusting inventory', 'error');
        return;
    }

    try {
        const res = await apiCall('/inventory/adjust', 'POST', {
            productId,
            newQuantity,
            reason
        });

        if (res && res.ok) {
            showToast(res.data.message || 'Stock adjusted successfully!', 'success');
            closeAdjustModal();
            loadInventory();
        } else {
            showToast(res ? res.data.message : 'Error adjusting stock', 'error');
        }
    } catch (err) {
        showToast('Server communication error', 'error');
    }
}

async function viewMovementsHistory() {
    try {
        const res = await apiCall('/inventory/movements?limit=40');
        if (!res || !res.ok) {
            showToast('Failed to load history', 'error');
            return;
        }

        const movements = res.data.data || [];
        const tbody = document.getElementById('movementsTableBody');
        if (tbody) {
            if (movements.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:25px; color:#94a3b8;">No inventory movement logs recorded yet.</td></tr>`;
            } else {
                tbody.innerHTML = movements.map(m => {
                    const date = formatDate(m.createdAt);
                    const prodName = m.product ? `${m.product.name} (${m.product.sku})` : 'Unknown Product';
                    const sign = m.quantity > 0 ? `+${m.quantity}` : `${m.quantity}`;
                    const deltaColor = m.quantity > 0 ? '#10b981' : '#ef4444';

                    return `
                        <tr>
                            <td style="color:#94a3b8;">${date}</td>
                            <td style="font-weight:600; color:white;">${prodName}</td>
                            <td><span class="badge ${m.type.toLowerCase()}">${m.type}</span></td>
                            <td style="color:${deltaColor}; font-weight:bold;">${sign}</td>
                            <td>${m.previousStock} → <strong>${m.newStock}</strong></td>
                            <td style="color:#cbd5e1;"><small>${m.reason || '-'} ${m.reference ? '(' + m.reference + ')' : ''}</small></td>
                        </tr>
                    `;
                }).join('');
            }
        }

        document.getElementById('movementsModal').classList.add('show');
    } catch (e) {
        showToast('Error loading movement audit history', 'error');
    }
}

function closeMovementsModal() {
    document.getElementById('movementsModal').classList.remove('show');
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
