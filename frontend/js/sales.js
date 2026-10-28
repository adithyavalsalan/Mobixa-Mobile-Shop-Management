/**
 * MOBIXA - Sales & Billing Controller
 * Handles live POS checkout, stock verification, receipt generation & returns
 */

let allSales = [];
let availableProducts = [];
let activeCart = [];

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireAuth();
    if (!user) return;

    loadSales();
    loadProductCatalog();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => filterSalesTable());
    }

    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', () => filterSalesTable());
    }

    const paymentFilter = document.getElementById('paymentFilter');
    if (paymentFilter) {
        paymentFilter.addEventListener('change', () => filterSalesTable());
    }

    // Modal submit listener
    const saleForm = document.getElementById('saleForm');
    if (saleForm) {
        saleForm.addEventListener('submit', handleSaleSubmit);
    }

    // Auto-calculate totals on discount input
    const discountInput = document.getElementById('saleDiscount');
    if (discountInput) {
        discountInput.addEventListener('input', () => updateCartCalculations());
    }
});

async function loadSales() {
    try {
        const res = await apiCall('/sales');
        if (!res || !res.ok) {
            showToast('Failed to load sales history', 'error');
            return;
        }

        allSales = res.data.data || [];
        const summary = res.data.summary || {};

        setText('totalRevenueDisplay', formatCurrency(summary.totalRevenue));
        setText('totalSalesDisplay', summary.totalSalesCount || 0);
        setText('todayRevenueDisplay', formatCurrency(summary.todayRevenue));
        setText('todaySalesDisplay', summary.todaySalesCount || 0);

        filterSalesTable();
    } catch (e) {
        console.error('Sales load error:', e);
        showToast('Error loading sales data', 'error');
    }
}

async function loadProductCatalog() {
    try {
        const res = await apiCall('/products');
        if (res && res.ok) {
            availableProducts = (res.data.data || []).filter(p => p.stock > 0);
            populateProductSelect();
        }
    } catch (e) {
        console.error('Products catalog error:', e);
    }
}

function populateProductSelect() {
    const select = document.getElementById('saleProductSelect');
    if (!select) return;

    if (availableProducts.length === 0) {
        select.innerHTML = '<option value="">No products in stock</option>';
        return;
    }

    select.innerHTML = '<option value="">-- Choose in-stock device/item --</option>' +
        availableProducts.map(p => `
            <option value="${p._id}" data-price="${p.sellingPrice}" data-stock="${p.stock}">
                ${p.name} (${p.brand}) - ₹${p.sellingPrice.toLocaleString()} [${p.stock} in stock]
            </option>
        `).join('');
}

function onProductSelect() {
    const select = document.getElementById('saleProductSelect');
    const opt = select.options[select.selectedIndex];
    const imeiContainer = document.getElementById('imeiSelectContainer');
    const imeiSelect = document.getElementById('saleImeiSelect');

    if (!opt || !opt.value) {
        if (imeiContainer) imeiContainer.style.display = 'none';
        return;
    }

    const prod = availableProducts.find(p => p._id === opt.value);
    if (prod && prod.imeiList && prod.imeiList.length > 0) {
        if (imeiContainer) imeiContainer.style.display = 'block';
        if (imeiSelect) {
            imeiSelect.innerHTML = '<option value="">-- Select IMEI (Optional) --</option>' +
                prod.imeiList.map(i => `<option value="${i}">${i}</option>`).join('');
        }
    } else {
        if (imeiContainer) imeiContainer.style.display = 'none';
    }
}

function addProductToCart() {
    const select = document.getElementById('saleProductSelect');
    const opt = select.options[select.selectedIndex];
    const qtyInput = document.getElementById('saleItemQty');
    const imeiSelect = document.getElementById('saleImeiSelect');

    if (!opt || !opt.value) {
        showToast('Please select a product first', 'error');
        return;
    }

    const qty = Number(qtyInput.value) || 1;
    const prod = availableProducts.find(p => p._id === opt.value);
    if (!prod) return;

    if (qty > prod.stock) {
        showToast(`Only ${prod.stock} units available in stock`, 'error');
        return;
    }

    const existingIndex = activeCart.findIndex(i => i.productId === prod._id);
    const selectedImei = imeiSelect ? imeiSelect.value : '';

    if (existingIndex > -1) {
        const newTotalQty = activeCart[existingIndex].quantity + qty;
        if (newTotalQty > prod.stock) {
            showToast(`Cannot add more than ${prod.stock} units of ${prod.name}`, 'error');
            return;
        }
        activeCart[existingIndex].quantity = newTotalQty;
        activeCart[existingIndex].total = newTotalQty * prod.sellingPrice;
    } else {
        activeCart.push({
            productId: prod._id,
            name: prod.name,
            sku: prod.sku,
            unitPrice: prod.sellingPrice,
            quantity: qty,
            imei: selectedImei,
            total: qty * prod.sellingPrice
        });
    }

    renderCartItems();
    select.value = '';
    qtyInput.value = 1;
    onProductSelect();
}

function removeCartItem(index) {
    activeCart.splice(index, 1);
    renderCartItems();
}

function renderCartItems() {
    const container = document.getElementById('cartItemsList');
    if (!container) return;

    if (activeCart.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:15px; color:#94a3b8; font-size:13px;">Cart is empty. Select a product above to add.</div>`;
    } else {
        container.innerHTML = activeCart.map((item, idx) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#0b0f1d; border-radius:8px; margin-bottom:6px; font-size:13px;">
                <div>
                    <strong>${item.name}</strong>
                    <small style="color:#94a3b8; display:block;">₹${item.unitPrice.toLocaleString()} × ${item.quantity} ${item.imei ? '• IMEI: ' + item.imei : ''}</small>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-weight:bold; color:#10b981;">₹${item.total.toLocaleString()}</span>
                    <button type="button" onclick="removeCartItem(${idx})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:14px;">✕</button>
                </div>
            </div>
        `).join('');
    }

    updateCartCalculations();
}

function updateCartCalculations() {
    const subtotal = activeCart.reduce((sum, item) => sum + item.total, 0);
    const discount = Number(document.getElementById('saleDiscount')?.value) || 0;
    const taxRate = 18; // 18% standard GST / VAT

    const taxableAmount = Math.max(0, subtotal - discount);
    const taxAmount = Math.round(taxableAmount * (taxRate / 100));
    const grandTotal = taxableAmount + taxAmount;

    setText('calcSubtotal', formatCurrency(subtotal));
    setText('calcTax', formatCurrency(taxAmount));
    setText('calcGrandTotal', formatCurrency(grandTotal));
}

function filterSalesTable() {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const status = document.getElementById('statusFilter')?.value || 'all';
    const payment = document.getElementById('paymentFilter')?.value || 'all';

    const filtered = allSales.filter(s => {
        const matchSearch = !search ||
            s.invoiceNumber.toLowerCase().includes(search) ||
            s.customerName.toLowerCase().includes(search) ||
            (s.customerPhone && s.customerPhone.includes(search)) ||
            (s.items || []).some(i => i.name.toLowerCase().includes(search));

        const matchStatus = (status === 'all') || (s.saleStatus && s.saleStatus.toLowerCase() === status.toLowerCase());
        const matchPayment = (payment === 'all') || (s.paymentMethod && s.paymentMethod.toLowerCase() === payment.toLowerCase());

        return matchSearch && matchStatus && matchPayment;
    });

    renderSalesTable(filtered);
}

function renderSalesTable(sales) {
    const tbody = document.getElementById('salesTableBody');
    if (!tbody) return;

    if (sales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#94a3b8;">No matching sales invoices found.</td></tr>`;
        return;
    }

    tbody.innerHTML = sales.map(s => {
        const date = formatDate(s.createdAt);
        const productsSummary = (s.items || []).map(i => `${i.name} (x${i.quantity})`).join(', ');
        const statusClass = s.saleStatus === 'Completed' ? 'completed' : 'cancelled';

        return `
            <tr>
                <td style="font-weight:700; color:#8b5cf6;">${s.invoiceNumber}</td>
                <td style="color:#94a3b8;">${date}</td>
                <td>
                    <div style="font-weight:600; color:white;">${s.customerName}</div>
                    <small style="color:#94a3b8;">${s.customerPhone || 'Walk-in'}</small>
                </td>
                <td><small style="color:#cbd5e1;">${productsSummary || '-'}</small></td>
                <td style="font-weight:700; color:#10b981;">${formatCurrency(s.grandTotal)}</td>
                <td><span class="badge ${s.paymentMethod.toLowerCase()}">${s.paymentMethod}</span></td>
                <td><span class="status ${statusClass}">${s.saleStatus}</span></td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button class="action-btn" onclick="viewReceipt('${s._id}')" title="View / Print Receipt">🧾 Print</button>
                        ${s.saleStatus === 'Completed' ? `<button class="action-btn delete-btn" onclick="cancelSaleModal('${s._id}', '${s.invoiceNumber}')" title="Return / Cancel">↩️ Return</button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openSaleModal() {
    activeCart = [];
    renderCartItems();
    const form = document.getElementById('saleForm');
    if (form) form.reset();
    document.getElementById('saleModal').classList.add('show');
}

function closeSaleModal() {
    document.getElementById('saleModal').classList.remove('show');
}

async function handleSaleSubmit(e) {
    e.preventDefault();

    if (activeCart.length === 0) {
        showToast('Please add at least one product item to the bill', 'error');
        return;
    }

    const customerName = document.getElementById('saleCustomerName').value.trim();
    const customerPhone = document.getElementById('saleCustomerPhone').value.trim();
    const paymentMethod = document.getElementById('salePaymentMethod').value;
    const discount = Number(document.getElementById('saleDiscount').value) || 0;

    const payload = {
        customerName,
        customerPhone,
        items: activeCart.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            imei: i.imei || ''
        })),
        discount,
        paymentMethod
    };

    try {
        const res = await apiCall('/sales', 'POST', payload);
        if (res && res.ok) {
            showToast('Sale completed successfully!', 'success');
            closeSaleModal();
            loadSales();
            loadProductCatalog();
            // Automatically prompt receipt
            if (res.data.data && res.data.data._id) {
                viewReceipt(res.data.data._id);
            }
        } else {
            showToast(res ? res.data.message : 'Error completing sale', 'error');
        }
    } catch (err) {
        showToast('Network error processing checkout', 'error');
    }
}

async function viewReceipt(saleId) {
    try {
        const res = await apiCall(`/sales/${saleId}`);
        if (!res || !res.ok) {
            showToast('Unable to fetch sale invoice', 'error');
            return;
        }

        const sale = res.data.data;
        const settings = res.data.settings || {};

        document.getElementById('receiptShopName').textContent = settings.shopName || 'MOBIXA MOBILE STORE';
        document.getElementById('receiptShopAddress').textContent = settings.address || '';
        document.getElementById('receiptShopPhone').textContent = `Phone: ${settings.phone || ''} | Email: ${settings.email || ''}`;

        document.getElementById('receiptInvoiceNo').textContent = sale.invoiceNumber;
        document.getElementById('receiptDate').textContent = new Date(sale.createdAt).toLocaleString();
        document.getElementById('receiptCustomerName').textContent = sale.customerName;
        document.getElementById('receiptCustomerPhone').textContent = sale.customerPhone || 'Walk-in';
        document.getElementById('receiptPaymentMethod').textContent = sale.paymentMethod;
        document.getElementById('receiptSoldBy').textContent = sale.soldBy ? sale.soldBy.name : 'Store Staff';

        const itemsBody = document.getElementById('receiptItemsBody');
        itemsBody.innerHTML = (sale.items || []).map(i => `
            <tr>
                <td style="padding:6px 0;">
                    <strong>${i.name}</strong>
                    ${i.imei ? `<small style="display:block; color:#555;">IMEI: ${i.imei}</small>` : ''}
                </td>
                <td style="text-align:center;">${i.quantity}</td>
                <td style="text-align:right;">₹${i.unitPrice.toLocaleString()}</td>
                <td style="text-align:right; font-weight:bold;">₹${i.total.toLocaleString()}</td>
            </tr>
        `).join('');

        document.getElementById('receiptSubtotal').textContent = formatCurrency(sale.subtotal);
        document.getElementById('receiptDiscount').textContent = `- ${formatCurrency(sale.discount)}`;
        document.getElementById('receiptTax').textContent = `${formatCurrency(sale.taxAmount)} (${sale.taxRate}%)`;
        document.getElementById('receiptGrandTotal').textContent = formatCurrency(sale.grandTotal);
        document.getElementById('receiptFooter').textContent = settings.invoiceFooter || 'Thank you for shopping with us!';

        document.getElementById('receiptModal').classList.add('show');
    } catch (e) {
        showToast('Error opening receipt preview', 'error');
    }
}

function closeReceiptModal() {
    document.getElementById('receiptModal').classList.remove('show');
}

function printReceipt() {
    window.print();
}

async function cancelSaleModal(id, invoiceNumber) {
    const reason = prompt(`Enter reason for returning/cancelling invoice ${invoiceNumber}:`);
    if (!reason || !reason.trim()) return;

    try {
        const res = await apiCall(`/sales/${id}/cancel`, 'POST', { reason: reason.trim() });
        if (res && res.ok) {
            showToast('Sale cancelled and inventory stock returned!', 'success');
            loadSales();
            loadProductCatalog();
        } else {
            showToast(res ? res.data.message : 'Error cancelling sale', 'error');
        }
    } catch (e) {
        showToast('Network error processing return', 'error');
    }
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
