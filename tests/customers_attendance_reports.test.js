const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../backend/server');
const User = require('../backend/models/User');
const Customer = require('../backend/models/Customer');
const Sale = require('../backend/models/Sale');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./setup');

describe('Customers, Attendance & Reports Suite', () => {
    let adminToken;
    let employeeToken;
    let empUser;

    before(async () => {
        await setupTestDB();
    });

    after(async () => {
        await teardownTestDB();
    });

    beforeEach(async () => {
        await clearTestDB();
        await User.create({
            name: 'Admin',
            email: 'admin@mobixa.com',
            password: 'password123',
            role: 'admin'
        });
        empUser = await User.create({
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

    test('POST /api/customers - creates customer and prevents duplicate phone', async () => {
        const res = await request(app)
            .post('/api/customers')
            .set('Authorization', `Bearer ${employeeToken}`)
            .send({
                name: 'Sunil Kumar',
                phone: '+91 94470 11111',
                email: 'sunil@test.com',
                address: 'Kochi'
            });

        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.body.success, true);

        // Duplicate phone check
        const dupRes = await request(app)
            .post('/api/customers')
            .set('Authorization', `Bearer ${employeeToken}`)
            .send({
                name: 'Another Sunil',
                phone: '+91 94470 11111'
            });

        assert.strictEqual(dupRes.status, 400);
        assert.strictEqual(dupRes.body.success, false);
    });

    test('POST /api/attendance/check-in & check-out lifecycle', async () => {
        // Initial status - not checked in
        const statusBefore = await request(app)
            .get('/api/attendance/today')
            .set('Authorization', `Bearer ${employeeToken}`);

        assert.strictEqual(statusBefore.status, 200);
        assert.strictEqual(statusBefore.body.data, null);

        // Check in
        const checkInRes = await request(app)
            .post('/api/attendance/check-in')
            .set('Authorization', `Bearer ${employeeToken}`);

        assert.strictEqual(checkInRes.status, 201);
        assert.strictEqual(checkInRes.body.success, true);
        assert.ok(checkInRes.body.data.checkIn);

        // Duplicate check in rejection
        const dupCheckIn = await request(app)
            .post('/api/attendance/check-in')
            .set('Authorization', `Bearer ${employeeToken}`);

        assert.strictEqual(dupCheckIn.status, 400);
        assert.strictEqual(dupCheckIn.body.success, false);

        // Check out
        const checkOutRes = await request(app)
            .post('/api/attendance/check-out')
            .set('Authorization', `Bearer ${employeeToken}`);

        assert.strictEqual(checkOutRes.status, 200);
        assert.ok(checkOutRes.body.data.checkOut);
    });

    test('GET /api/reports/generate - generates sales and inventory reports', async () => {
        const res = await request(app)
            .get('/api/reports/generate?reportType=sales')
            .set('Authorization', `Bearer ${adminToken}`);

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.reportType, 'sales');
        assert.ok(res.body.summary);
    });

    test('GET /api/health - reports connected database readiness', async () => {
        const res = await request(app).get('/api/health');

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'UP');
        assert.strictEqual(res.body.database.isConnected, true);
    });

    test('GET /api/reports/generate - rejects invalid date ranges', async () => {
        const invalidDate = await request(app)
            .get('/api/reports/generate?startDate=2026-02-30')
            .set('Authorization', `Bearer ${adminToken}`);
        const reversedRange = await request(app)
            .get('/api/reports/generate?startDate=2026-10-10&endDate=2026-10-09')
            .set('Authorization', `Bearer ${adminToken}`);

        assert.strictEqual(invalidDate.status, 400);
        assert.strictEqual(reversedRange.status, 400);
    });

    test('GET /api/reports/export-csv - escapes formula-like customer data', async () => {
        await Customer.create({
            name: '=HYPERLINK("https://example.com","open")',
            phone: '1234567890'
        });

        const res = await request(app)
            .get('/api/reports/export-csv?reportType=customers')
            .set('Authorization', `Bearer ${adminToken}`);

        assert.strictEqual(res.status, 200);
        assert.match(res.text, /"'=HYPERLINK\(""https:\/\/example\.com"",""open""\)","1234567890"/);
    });

    test('GET /api/employees/:id - reports lifetime sales beyond recent-sales limit', async () => {
        await Sale.create(Array.from({ length: 21 }, (_, index) => ({
            invoiceNumber: `EMP-${String(index + 1).padStart(4, '0')}`,
            customerName: 'Test Customer',
            soldBy: empUser._id,
            items: [],
            subtotal: 100,
            grandTotal: 100,
            saleStatus: 'Completed'
        })));

        const res = await request(app)
            .get(`/api/employees/${empUser._id}`)
            .set('Authorization', `Bearer ${adminToken}`);

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.data.stats.totalSalesCount, 21);
        assert.strictEqual(res.body.data.stats.totalSalesAmount, 2100);
        assert.strictEqual(res.body.data.recentSales.length, 20);
    });
});
