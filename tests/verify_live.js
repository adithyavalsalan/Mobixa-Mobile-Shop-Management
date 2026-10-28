const http = require('http');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const BASE_URL = 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mobixa.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const EMPLOYEE_EMAIL = process.env.EMPLOYEE_EMAIL || 'employee@mobixa.com';
const EMPLOYEE_PASSWORD = process.env.EMPLOYEE_PASSWORD;

function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const reqOptions = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        if (options.body) {
            reqOptions.headers['Content-Type'] = 'application/json';
        }

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = data;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    // html or plain text
                }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        req.end();
    });
}

async function runLiveVerification() {
    if (!ADMIN_PASSWORD || !EMPLOYEE_PASSWORD) {
        console.error('Set ADMIN_PASSWORD and EMPLOYEE_PASSWORD in .env to run live verification.');
        process.exitCode = 1;
        return;
    }

    console.log('====================================================');
    console.log('MOBIXA LIVE SERVER END-TO-END VERIFICATION');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  [PASS] ${message}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${message}`);
            failed++;
        }
    }

    // 1. Health Check
    console.log('--- 1. Health & Server Status ---');
    const health = await request('/api/health');
    assert(health.status === 200, 'Health endpoint responds with 200 OK');
    assert(health.body.success === true, 'Health reports success = true');
    assert(health.body.database && health.body.database.isConnected === true, 'Database is connected to MongoDB');

    // 2. Static Frontend Pages
    console.log('\n--- 2. Static Frontend Serving ---');
    const pages = [
        '/',
        '/login.html',
        '/dashboard.html',
        '/employee-dashboard.html',
        '/products.html',
        '/inventory.html',
        '/sales.html',
        '/customer.html',
        '/employees.html',
        '/attendance.html',
        '/reports.html',
        '/settings.html',
        '/css/style.css',
        '/js/api.js'
    ];

    for (const page of pages) {
        const res = await request(page);
        assert(res.status === 200, `Static route "${page}" returns 200 OK`);
    }

    // 3. Admin Authentication
    console.log('\n--- 3. Admin Authentication & JWT ---');
    const loginRes = await request('/api/auth/login', {
        method: 'POST',
        body: {
            usernameOrEmail: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            role: 'admin'
        }
    });

    assert(loginRes.status === 200, 'Admin login succeeded with 200 OK');
    assert(loginRes.body.token && loginRes.body.user.role === 'admin', 'Returned valid JWT and admin role');
    const adminToken = loginRes.body.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    // 4. Admin Dashboard Metrics
    console.log('\n--- 4. Live Admin Dashboard Metrics ---');
    const dashRes = await request('/api/dashboard/admin', { headers: adminHeaders });
    assert(dashRes.status === 200, 'Admin dashboard metrics retrieved successfully');
    assert(dashRes.body.data.metrics.totalProducts > 0, `Total products from DB: ${dashRes.body.data.metrics.totalProducts}`);
    assert(Array.isArray(dashRes.body.data.recentTransactions), 'Recent sales transactions returned from DB');

    // 5. Product Creation with IMEI
    console.log('\n--- 5. Product Creation & Serialized IMEI Tracking ---');
    const testSku = `TEST-PH-${Date.now().toString().slice(-4)}`;
    const testImei1 = `35899901${Date.now().toString().slice(-7)}`;
    const testImei2 = `35899902${Date.now().toString().slice(-7)}`;

    const newProductRes = await request('/api/products', {
        method: 'POST',
        headers: adminHeaders,
        body: {
            name: 'OnePlus 12 Test Edition',
            category: 'Smartphones',
            brand: 'OnePlus',
            modelName: '12-Test',
            sku: testSku,
            purchaseCost: 45000,
            sellingPrice: 55000,
            stock: 2,
            minStockLevel: 1,
            imeiList: [testImei1, testImei2]
        }
    });

    assert(newProductRes.status === 201, `Created product "${testSku}" with 201 Created`);
    const createdProduct = newProductRes.body.data;
    assert(createdProduct.stock === 2, 'Stock quantity correctly set to 2');
    assert(createdProduct.imeiList.length === 2, 'IMEI list contains 2 serials');

    // 6. Customer Creation
    console.log('\n--- 6. Customer Management & Purchase Tracking ---');
    const testPhone = `9876${Date.now().toString().slice(-6)}`;
    const customerRes = await request('/api/customers', {
        method: 'POST',
        headers: adminHeaders,
        body: {
            name: 'Priya Sharma',
            phone: testPhone,
            email: `priya_${Date.now()}@example.com`,
            city: 'Bangalore'
        }
    });

    assert(customerRes.status === 201, `Created customer "${testPhone}" with 201 Created`);
    const createdCustomer = customerRes.body.data;

    // 7. POS Sale Execution & Inventory Deduction
    console.log('\n--- 7. POS Sale Execution & Atomic Stock Deduction ---');
    const saleRes = await request('/api/sales', {
        method: 'POST',
        headers: adminHeaders,
        body: {
            customerName: createdCustomer.name,
            customerPhone: createdCustomer.phone,
            items: [{
                productId: createdProduct._id,
                quantity: 1,
                imei: testImei1
            }],
            discount: 1000,
            paymentMethod: 'UPI'
        }
    });

    assert(saleRes.status === 201, 'POS sale created with 201 Created');
    const createdSale = saleRes.body.data;
    assert(createdSale.subtotal === 55000, 'Subtotal correctly computed (55000)');
    assert(createdSale.discount === 1000, 'Discount applied (1000)');
    // 54000 * 1.18 = 63720
    assert(createdSale.grandTotal === 63720, `Grand total with 18% GST matches 63720 (actual: ${createdSale.grandTotal})`);

    // Verify stock deduction on product
    const productCheck = await request(`/api/products/${createdProduct._id}`, { headers: adminHeaders });
    assert(productCheck.body.data.stock === 1, `Product stock deducted from 2 to 1 (actual: ${productCheck.body.data.stock})`);
    assert(!productCheck.body.data.imeiList.includes(testImei1), `Sold IMEI ${testImei1} deducted from available imeiList`);

    // 8. Customer Order History
    console.log('\n--- 8. Customer Purchase History Record ---');
    const custHistory = await request(`/api/customers/${createdCustomer._id}`, { headers: adminHeaders });
    assert(custHistory.status === 200, 'Customer profile endpoint returned 200');
    assert(custHistory.body.data.purchaseHistory.length === 1, 'Customer purchase history recorded 1 sale');
    assert(custHistory.body.data.customer.totalSpent === 63720, `Customer totalSpent updated to ${custHistory.body.data.customer.totalSpent}`);

    // 9. Employee Login & Dashboard
    console.log('\n--- 9. Employee Authentication & Scoped Dashboard ---');
    const empLogin = await request('/api/auth/login', {
        method: 'POST',
        body: {
            usernameOrEmail: EMPLOYEE_EMAIL,
            password: EMPLOYEE_PASSWORD,
            role: 'employee'
        }
    });
    assert(empLogin.status === 200, 'Employee login succeeded');
    const empToken = empLogin.body.token;
    const empHeaders = { Authorization: `Bearer ${empToken}` };

    const empDash = await request('/api/dashboard/employee', { headers: empHeaders });
    assert(empDash.status === 200, 'Employee dashboard returned 200 OK');
    assert(empDash.body.data.user.email === 'employee@mobixa.com', 'Employee dashboard scoped to employee');

    // 10. Role-Based Access Control Guards (Admin Only Protection)
    console.log('\n--- 10. Security: Role-Based Authorization Enforcement ---');
    // Employee trying to access employee list
    const forbidden1 = await request('/api/employees', { headers: empHeaders });
    assert(forbidden1.status === 403, 'Employee blocked from GET /api/employees (403 Forbidden)');

    // Employee trying to access admin dashboard
    const forbidden2 = await request('/api/dashboard/admin', { headers: empHeaders });
    assert(forbidden2.status === 403, 'Employee blocked from GET /api/dashboard/admin (403 Forbidden)');

    // Employee trying to adjust inventory
    const forbidden3 = await request('/api/inventory/adjust', {
        method: 'POST',
        headers: empHeaders,
        body: {
            productId: createdProduct._id,
            adjustmentQuantity: 5,
            reason: 'Audit correction'
        }
    });
    assert(forbidden3.status === 403, 'Employee blocked from POST /api/inventory/adjust (403 Forbidden)');

    // 11. Reports & Financials
    console.log('\n--- 11. Comprehensive Reporting & Gross Profit Calculation ---');
    const reportRes = await request('/api/reports/generate?reportType=sales', { headers: adminHeaders });
    assert(reportRes.status === 200, 'Sales report generated with 200 OK');
    assert(reportRes.body.summary.netRevenue > 0, `Total report net revenue: ₹${reportRes.body.summary.netRevenue}`);
    assert(reportRes.body.summary.grossProfit !== undefined, `Report calculated gross profit: ₹${reportRes.body.summary.grossProfit}`);

    // 12. Sale Cancellation / Return Stock Restoration
    console.log('\n--- 12. Sale Cancellation & Stock Rollback ---');
    const cancelRes = await request(`/api/sales/${createdSale._id}/cancel`, {
        method: 'POST',
        headers: adminHeaders,
        body: { reason: 'Customer returned item within 24 hours' }
    });
    assert(cancelRes.status === 200, 'Sale cancelled successfully with 200 OK');
    assert(cancelRes.body.data.saleStatus === 'Cancelled', 'Sale status updated to Cancelled');

    // Verify stock restoration
    const restoredProduct = await request(`/api/products/${createdProduct._id}`, { headers: adminHeaders });
    assert(restoredProduct.body.data.stock === 2, `Product stock restored back to 2 (actual: ${restoredProduct.body.data.stock})`);
    assert(restoredProduct.body.data.imeiList.includes(testImei1), `IMEI ${testImei1} restored back to imeiList after cancellation`);

    console.log('\n====================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runLiveVerification().catch(err => {
    console.error('Live verification error:', err);
    process.exit(1);
});
