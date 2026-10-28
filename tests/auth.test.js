const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../backend/server');
const User = require('../backend/models/User');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./setup');

describe('Authentication & Authorization Suite', () => {
    before(async () => {
        await setupTestDB();
    });

    after(async () => {
        await teardownTestDB();
    });

    beforeEach(async () => {
        await clearTestDB();
        // Seed an admin and an employee
        await User.create({
            name: 'Admin User',
            email: 'admin@mobixa.com',
            username: 'admin',
            password: 'admin123Password',
            role: 'admin',
            status: 'active'
        });
        await User.create({
            name: 'Employee User',
            email: 'emp@mobixa.com',
            username: 'employee',
            password: 'emp123Password',
            role: 'employee',
            status: 'active'
        });
    });

    test('POST /api/auth/login - valid admin login', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'admin@mobixa.com',
                password: 'admin123Password',
                role: 'admin'
            });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.token);
        assert.strictEqual(res.body.user.role, 'admin');
        assert.strictEqual(res.body.user.password, undefined);
    });

    test('POST /api/auth/login - valid login using username', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'employee',
                password: 'emp123Password',
                role: 'employee'
            });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.user.role, 'employee');
    });

    test('POST /api/auth/login - incorrect password rejection', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'admin@mobixa.com',
                password: 'wrongPassword',
                role: 'admin'
            });

        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.success, false);
    });

    test('POST /api/auth/login - role mismatch rejection', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'emp@mobixa.com',
                password: 'emp123Password',
                role: 'admin' // Attempting to log in as admin with employee account
            });

        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.success, false);
    });

    test('GET /api/auth/me - requires valid token', async () => {
        const unauthRes = await request(app).get('/api/auth/me');
        assert.strictEqual(unauthRes.status, 401);

        // Login first
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@mobixa.com', password: 'admin123Password', role: 'admin' });

        const authRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${loginRes.body.token}`);

        assert.strictEqual(authRes.status, 200);
        assert.strictEqual(authRes.body.user.email, 'admin@mobixa.com');
    });

    test('POST /api/auth/logout - clears authentication', async () => {
        const res = await request(app).post('/api/auth/logout');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
    });
});
