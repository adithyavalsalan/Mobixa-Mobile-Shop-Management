const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../backend/server');
const User = require('../backend/models/User');
const Product = require('../backend/models/Product');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./setup');

describe('Product Management API Suite', () => {
    let adminToken;
    let employeeToken;

    before(async () => {
        await setupTestDB();
    });

    after(async () => {
        await teardownTestDB();
    });

    beforeEach(async () => {
        await clearTestDB();
        const admin = await User.create({
            name: 'Admin',
            email: 'admin@mobixa.com',
            password: 'password123',
            role: 'admin'
        });
        const emp = await User.create({
            name: 'Employee',
            email: 'emp@mobixa.com',
            password: 'password123',
            role: 'employee'
        });

        const adminLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@mobixa.com', password: 'password123', role: 'admin' });
        adminToken = adminLogin.body.token;

        const empLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: 'emp@mobixa.com', password: 'password123', role: 'employee' });
        employeeToken = empLogin.body.token;
    });

    test('POST /api/products - creates new product and initial stock movement', async () => {
        const res = await request(app)
            .post('/api/products')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'iPhone 15 Pro',
                sku: 'IPH-15P-128',
                brand: 'Apple',
                category: 'Smartphones',
                purchaseCost: 90000,
                sellingPrice: 109900,
                stock: 10,
                minStockLevel: 3,
                imeiList: ['359920192837451', '359920192837452']
            });

        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.data.name, 'iPhone 15 Pro');
        assert.strictEqual(res.body.data.sku, 'IPH-15P-128');
        assert.strictEqual(res.body.data.stock, 10);

        const saved = await Product.findOne({ sku: 'IPH-15P-128' });
        assert.ok(saved);
        assert.strictEqual(saved.imeiList.length, 2);
    });

    test('POST /api/products - rejects duplicate SKU', async () => {
        await request(app)
            .post('/api/products')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Device 1',
                sku: 'DUP-SKU-1',
                brand: 'TestBrand',
                purchaseCost: 1000,
                sellingPrice: 1500,
                stock: 5
            });

        const dupRes = await request(app)
            .post('/api/products')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Device 2',
                sku: 'DUP-SKU-1',
                brand: 'TestBrand',
                purchaseCost: 1000,
                sellingPrice: 1500,
                stock: 2
            });

        assert.strictEqual(dupRes.status, 400);
        assert.strictEqual(dupRes.body.success, false);
    });

    test('GET /api/products - search and filter by brand and stock status', async () => {
        await Product.create({
            name: 'Galaxy S24 Ultra',
            sku: 'SAM-S24U',
            brand: 'Samsung',
            purchaseCost: 80000,
            sellingPrice: 119999,
            stock: 8,
            minStockLevel: 5
        });

        await Product.create({
            name: 'Pixel 9 Pro',
            sku: 'PIX-9P',
            brand: 'Google',
            purchaseCost: 75000,
            sellingPrice: 99999,
            stock: 2, // low stock!
            minStockLevel: 5
        });

        const searchRes = await request(app)
            .get('/api/products?search=Galaxy')
            .set('Authorization', `Bearer ${employeeToken}`);

        assert.strictEqual(searchRes.status, 200);
        assert.strictEqual(searchRes.body.data.length, 1);
        assert.strictEqual(searchRes.body.data[0].brand, 'Samsung');

        const lowStockRes = await request(app)
            .get('/api/products?stockStatus=low')
            .set('Authorization', `Bearer ${employeeToken}`);

        assert.strictEqual(lowStockRes.status, 200);
        assert.strictEqual(lowStockRes.body.data.length, 1);
        assert.strictEqual(lowStockRes.body.data[0].name, 'Pixel 9 Pro');
    });

    test('GET /api/products - applies page and limit parameters', async () => {
        await Product.create([
            { name: 'Device One', sku: 'PAGE-01', brand: 'Test', purchaseCost: 10, sellingPrice: 20, stock: 5 },
            { name: 'Device Two', sku: 'PAGE-02', brand: 'Test', purchaseCost: 10, sellingPrice: 20, stock: 5 },
            { name: 'Device Three', sku: 'PAGE-03', brand: 'Test', purchaseCost: 10, sellingPrice: 20, stock: 5 }
        ]);

        const res = await request(app)
            .get('/api/products?page=2&limit=1')
            .set('Authorization', `Bearer ${adminToken}`);

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.data.length, 1);
        assert.deepStrictEqual(res.body.pagination, {
            page: 2,
            limit: 1,
            totalResults: 3,
            totalPages: 3
        });
    });

    test('DELETE /api/products/:id - only admin can delete', async () => {
        const prod = await Product.create({
            name: 'Old Accessory',
            sku: 'ACC-OLD-01',
            brand: 'Generic',
            purchaseCost: 100,
            sellingPrice: 300,
            stock: 0
        });

        const empDel = await request(app)
            .delete(`/api/products/${prod._id}`)
            .set('Authorization', `Bearer ${employeeToken}`);

        assert.strictEqual(empDel.status, 403); // Forbidden for employee

        const adminDel = await request(app)
            .delete(`/api/products/${prod._id}`)
            .set('Authorization', `Bearer ${adminToken}`);

        assert.strictEqual(adminDel.status, 200);
        assert.strictEqual(adminDel.body.success, true);
    });
});
