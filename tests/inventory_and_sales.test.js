const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../backend/server');
const User = require('../backend/models/User');
const Product = require('../backend/models/Product');
const Sale = require('../backend/models/Sale');
const InventoryMovement = require('../backend/models/InventoryMovement');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./setup');

describe('Inventory & Sales Billing POS Suite', () => {
    let adminToken;
    let employeeToken;
    let testProduct;

    before(async () => {
        await setupTestDB();
    });

    after(async () => {
        await teardownTestDB();
    });

    beforeEach(async () => {
        await clearTestDB();
        await User.create({
            name: 'Store Admin',
            email: 'admin@mobixa.com',
            password: 'password123',
            role: 'admin'
        });
        await User.create({
            name: 'Staff Rahul',
            email: 'rahul@mobixa.com',
            password: 'password123',
            role: 'employee'
        });

        const adminLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@mobixa.com', password: 'password123', role: 'admin' });
        adminToken = adminLogin.body.token;

        const empLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: 'rahul@mobixa.com', password: 'password123', role: 'employee' });
        employeeToken = empLogin.body.token;

        testProduct = await Product.create({
            name: 'OnePlus 12',
            sku: 'OP-12-TEST',
            brand: 'OnePlus',
            purchaseCost: 50000,
            sellingPrice: 60000,
            stock: 10,
            minStockLevel: 3,
            imeiList: ['111111111111111', '222222222222222']
        });
    });

    test('POST /api/inventory/stock-in - replenishes inventory count', async () => {
        const res = await request(app)
            .post('/api/inventory/stock-in')
            .set('Authorization', `Bearer ${employeeToken}`)
            .send({
                productId: testProduct._id,
                quantity: 5,
                reason: 'Shipment from distributor',
                reference: 'PO-9901'
            });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.data.product.stock, 15);

        const updated = await Product.findById(testProduct._id);
        assert.strictEqual(updated.stock, 15);

        const movement = await InventoryMovement.findOne({ reference: 'PO-9901' });
        assert.ok(movement);
        assert.strictEqual(movement.type, 'IN');
        assert.strictEqual(movement.quantity, 5);
    });

    test('POST /api/inventory/adjust - requires admin role and valid reason', async () => {
        const empRes = await request(app)
            .post('/api/inventory/adjust')
            .set('Authorization', `Bearer ${employeeToken}`)
            .send({
                productId: testProduct._id,
                newQuantity: 8,
                reason: 'Physical count discrepancy'
            });
        assert.strictEqual(empRes.status, 403); // Employees cannot adjust stock arbitrarily

        const adminRes = await request(app)
            .post('/api/inventory/adjust')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                productId: testProduct._id,
                newQuantity: 7,
                reason: '3 units damaged in transit'
            });

        assert.strictEqual(adminRes.status, 200);
        assert.strictEqual(adminRes.body.data.product.stock, 7);

        const updated = await Product.findById(testProduct._id);
        assert.strictEqual(updated.stock, 7);
    });

    test('POST /api/sales - successful sale reduces stock and calculates tax', async () => {
        const res = await request(app)
            .post('/api/sales')
            .set('Authorization', `Bearer ${employeeToken}`)
            .send({
                customerName: 'Kavita Menon',
                customerPhone: '+91 98470 12345',
                items: [
                    {
                        productId: testProduct._id,
                        quantity: 2,
                        imei: '111111111111111'
                    }
                ],
                discount: 1000,
                paymentMethod: 'UPI'
            });

        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.body.success, true);

        const sale = res.body.data;
        assert.ok(sale.invoiceNumber.startsWith('MOB-'));
        assert.strictEqual(sale.subtotal, 120000); // 2 * 60,000
        assert.strictEqual(sale.discount, 1000);
        // Taxable = 119,000 * 18% = 21,420
        assert.strictEqual(sale.taxAmount, 21420);
        // Grand Total = 119,000 + 21,420 = 140,420
        assert.strictEqual(sale.grandTotal, 140420);

        // Check stock reduced from 10 to 8
        const updated = await Product.findById(testProduct._id);
        assert.strictEqual(updated.stock, 8);
        // IMEI removed from available list
        assert.strictEqual(updated.imeiList.includes('111111111111111'), false);
    });

    test('POST /api/sales - rejects sale if requested quantity exceeds stock', async () => {
        const res = await request(app)
            .post('/api/sales')
            .set('Authorization', `Bearer ${employeeToken}`)
            .send({
                customerName: 'Oversell Tester',
                customerPhone: '+91 98000 00000',
                items: [
                    {
                        productId: testProduct._id,
                        quantity: 99 // Available is only 10!
                    }
                ]
            });

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.success, false);
        assert.ok(res.body.message.includes('Insufficient stock'));

        // Stock unchanged
        const product = await Product.findById(testProduct._id);
        assert.strictEqual(product.stock, 10);
    });

    test('POST /api/sales - rejects duplicate lines that exceed available stock', async () => {
        const res = await request(app)
            .post('/api/sales')
            .set('Authorization', `Bearer ${employeeToken}`)
            .send({
                customerName: 'Duplicate Item Tester',
                items: [
                    { productId: testProduct._id, quantity: 6 },
                    { productId: testProduct._id, quantity: 5 }
                ]
            });

        assert.strictEqual(res.status, 400);
        assert.ok(res.body.message.includes('Insufficient stock'));
        const product = await Product.findById(testProduct._id);
        assert.strictEqual(product.stock, 10);
        assert.strictEqual(await Sale.countDocuments(), 0);
    });

    test('POST /api/sales - rejects fractional quantities', async () => {
        const res = await request(app)
            .post('/api/sales')
            .set('Authorization', `Bearer ${employeeToken}`)
            .send({
                customerName: 'Fractional Quantity Tester',
                items: [{ productId: testProduct._id, quantity: 1.5 }]
            });

        assert.strictEqual(res.status, 400);
        const product = await Product.findById(testProduct._id);
        assert.strictEqual(product.stock, 10);
    });

    test('POST /api/sales/:id/cancel - cancels sale and returns stock to inventory', async () => {
        // Create a sale first
        const saleRes = await request(app)
            .post('/api/sales')
            .set('Authorization', `Bearer ${employeeToken}`)
            .send({
                customerName: 'Return Customer',
                customerPhone: '+91 98950 55555',
                items: [
                    {
                        productId: testProduct._id,
                        quantity: 3
                    }
                ]
            });

        const saleId = saleRes.body.data._id;
        let prod = await Product.findById(testProduct._id);
        assert.strictEqual(prod.stock, 7); // 10 - 3

        // Cancel sale
        const cancelRes = await request(app)
            .post(`/api/sales/${saleId}/cancel`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ reason: 'Customer returned device within return policy' });

        assert.strictEqual(cancelRes.status, 200);
        assert.strictEqual(cancelRes.body.data.saleStatus, 'Cancelled');

        // Verify stock is restored back to 10
        prod = await Product.findById(testProduct._id);
        assert.strictEqual(prod.stock, 10);
    });
});
