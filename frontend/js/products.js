/**
 * MOBIXA - Products Management Controller
 * Fully integrated with MongoDB backend
 */

let allProducts = [];
let currentEditingId = null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await requireAuth();
    if (!currentUser) return;

    loadProducts();

    // Attach search and filter listeners
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => filterTable());
    }

    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => filterTable());
    }

    const stockFilter = document.getElementById('stockFilter');
    if (stockFilter) {
        stockFilter.addEventListener('change', () => filterTable());
    }

    // Modal submit listener
    const form = document.getElementById('productForm');
    if (form) {
        form.addEventListener('submit', handleProductSubmit);
    }
});

async function loadProducts() {
    try {
        const res = await apiCall('/products');
        if (!res || !res.ok) {
            showToast('Failed to load products list', 'error');
            return;
        }

        allProducts = res.data.data || [];
        const summary = res.data.summary || {};

        setText('totalProducts', summary.totalProducts || allProducts.length);
        setText('inStockCount', summary.inStockCount || 0);
        setText('lowStockCount', summary.lowStockCount || 0);
        setText('outOfStockCount', summary.outOfStockCount || 0);

        filterTable();
    } catch (e) {
        console.error('Error loading products:', e);
        showToast('Error communicating with products API', 'error');
    }
}

function filterTable() {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const category = document.getElementById('categoryFilter')?.value || 'all';
    const stock = document.getElementById('stockFilter')?.value || 'all';

    let filtered = allProducts.filter(p => {
        const matchSearch = !search ||
            (p.name && p.name.toLowerCase().includes(search)) ||
            (p.brand && p.brand.toLowerCase().includes(search)) ||
            (p.sku && p.sku.toLowerCase().includes(search)) ||
            (p.modelName && p.modelName.toLowerCase().includes(search));

        const matchCat = (category === 'all') || (p.category && p.category.toLowerCase() === category.toLowerCase());

        let matchStock = true;
        if (stock === 'in') matchStock = p.stock > p.minStockLevel;
        else if (stock === 'low') matchStock = p.stock > 0 && p.stock <= p.minStockLevel;
        else if (stock === 'out') matchStock = p.stock === 0;

        return matchSearch && matchCat && matchStock;
    });

    renderProductTable(filtered);
}

function renderProductTable(products) {
    const tbody = document.getElementById('productTableBody');
    if (!tbody) return;

    if (products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">No products found matching the criteria.</td></tr>`;
        return;
    }

    tbody.innerHTML = products.map(p => {
        let statusBadge = '<span class="status in">In Stock</span>';
        if (p.stock === 0) {
            statusBadge = '<span class="status out">Out of Stock</span>';
        } else if (p.stock <= p.minStockLevel) {
            statusBadge = '<span class="status low">Low Stock</span>';
        }

        const imeisCount = p.imeiList ? p.imeiList.length : 0;
        const imeiDisplay = imeisCount > 0 ? `<small style="display:block; color:#8b5cf6;">${imeisCount} IMEI(s) registered</small>` : '';

        return `
            <tr>
                <td>
                    <div style="font-weight:600; color:white;">${escapeHtml(p.name)}</div>
                    <small style="color:#94a3b8;">${escapeHtml(p.brand)} ${p.modelName ? '• ' + escapeHtml(p.modelName) : ''}</small>
                    ${imeiDisplay}
                </td>
                <td style="font-family:monospace; color:#a5b4fc;">${escapeHtml(p.sku)}</td>
                <td><span class="category-badge">${escapeHtml(p.category)}</span></td>
                <td>${formatCurrency(p.purchaseCost)}</td>
                <td style="font-weight:700; color:#10b981;">${formatCurrency(p.sellingPrice)}</td>
                <td style="font-weight:bold;">${p.stock}</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button class="action-btn" onclick="openEditModal('${escapeHtml(p._id)}')" title="Edit Product">✏️</button>
                        <button class="action-btn" onclick="viewProductDetails('${escapeHtml(p._id)}')" title="View Details">👁️</button>
                        ${currentUser.role === 'admin' ? `<button class="action-btn delete-btn" onclick="deleteProductById('${escapeHtml(p._id)}')" title="Delete Product">🗑️</button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openAddModal() {
    currentEditingId = null;
    const form = document.getElementById('productForm');
    if (form) form.reset();
    setText('modalTitle', 'Add New Mobile Product');
    document.getElementById('productModal').classList.add('show');
}

async function openEditModal(id) {
    currentEditingId = id;
    const p = allProducts.find(item => item._id === id);
    if (!p) return;

    setText('modalTitle', 'Edit Product');
    setVal('prodName', p.name);
    setVal('prodSku', p.sku);
    setVal('prodBrand', p.brand);
    setVal('prodModel', p.modelName || '');
    setVal('prodCategory', p.category || 'Smartphones');
    setVal('prodCost', p.purchaseCost);
    setVal('prodPrice', p.sellingPrice);
    setVal('prodStock', p.stock);
    setVal('prodMinStock', p.minStockLevel || 5);
    setVal('prodStorage', p.storage || '');
    setVal('prodColor', p.color || '');
    setVal('prodImeis', (p.imeiList || []).join(', '));
    setVal('prodDesc', p.description || '');

    // Stock count should be changed via Inventory Stock-In/Adjustment to maintain audit trail
    const stockField = document.getElementById('prodStock');
    if (stockField) stockField.disabled = true;

    document.getElementById('productModal').classList.add('show');
}

function closeModal() {
    const modal = document.getElementById('productModal');
    if (modal) modal.classList.remove('show');
    const stockField = document.getElementById('prodStock');
    if (stockField) stockField.disabled = false;
    currentEditingId = null;
}

async function handleProductSubmit(e) {
    e.preventDefault();

    const name = getVal('prodName');
    const sku = getVal('prodSku');
    const brand = getVal('prodBrand');
    const modelName = getVal('prodModel');
    const category = getVal('prodCategory');
    const purchaseCost = Number(getVal('prodCost'));
    const sellingPrice = Number(getVal('prodPrice'));
    const stock = Number(getVal('prodStock')) || 0;
    const minStockLevel = Number(getVal('prodMinStock')) || 5;
    const storage = getVal('prodStorage');
    const color = getVal('prodColor');
    const imeiString = getVal('prodImeis');
    const description = getVal('prodDesc');

    const imeiList = imeiString ? imeiString.split(',').map(s => s.trim()).filter(Boolean) : [];

    const payload = {
        name,
        sku,
        brand,
        modelName,
        category,
        purchaseCost,
        sellingPrice,
        minStockLevel,
        storage,
        color,
        imeiList,
        description
    };

    if (!currentEditingId) {
        payload.stock = stock;
    }

    try {
        let res;
        if (currentEditingId) {
            res = await apiCall(`/products/${currentEditingId}`, 'PUT', payload);
        } else {
            res = await apiCall('/products', 'POST', payload);
        }

        if (res && res.ok) {
            showToast(res.data.message || 'Product saved successfully!', 'success');
            closeModal();
            loadProducts();
        } else {
            showToast(res ? res.data.message : 'Failed to save product', 'error');
        }
    } catch (err) {
        console.error('Save product error:', err);
        showToast('Error saving product to backend', 'error');
    }
}

async function deleteProductById(id) {
    const product = allProducts.find(item => item._id === id);
    const name = product ? product.name : 'this product';
    if (!confirm(`Are you sure you want to delete or archive '${name}'?`)) return;

    try {
        const res = await apiCall(`/products/${id}`, 'DELETE');
        if (res && res.ok) {
            showToast(res.data.message || 'Product removed successfully', 'success');
            loadProducts();
        } else {
            showToast(res ? res.data.message : 'Error deleting product', 'error');
        }
    } catch (e) {
        showToast('Server communication error', 'error');
    }
}

function viewProductDetails(id) {
    const p = allProducts.find(item => item._id === id);
    if (!p) return;

    const imeisHtml = (p.imeiList && p.imeiList.length > 0)
        ? p.imeiList.map(i => `<span style="background:rgba(99,102,241,0.2); padding:2px 8px; border-radius:4px; font-size:11px; margin-right:4px;">${escapeHtml(i)}</span>`).join('')
        : '<em>None recorded</em>';

    const info = `
        Product: ${p.name}
        Brand: ${p.brand} | Model: ${p.modelName || 'N/A'}
        Category: ${p.category} | Storage: ${p.storage || 'N/A'} | Color: ${p.color || 'N/A'}
        SKU: ${p.sku}
        Cost Price: ₹${p.purchaseCost.toLocaleString()}
        Selling Price: ₹${p.sellingPrice.toLocaleString()}
        Current Stock: ${p.stock} units (Min alert level: ${p.minStockLevel})
        IMEI / Serial Numbers: ${p.imeiList ? p.imeiList.join(', ') : 'None'}
        Description: ${p.description || 'No description entered'}
    `;

    alert(info);
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
