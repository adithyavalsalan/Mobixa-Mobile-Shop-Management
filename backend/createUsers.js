
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('./models/User');

async function createUser({ name, email, username, password, role, designation }) {
    const existing = await User.findOne({
        $or: [{ email }, { username }]
    });

    if (existing) {
        console.log(`${role} account already exists: ${email}`);
        return;
    }

    await User.create({
        name,
        email,
        username,
        password,
        role,
        designation,
        status: 'active'
    });

    console.log(`${role} account created: ${email}`);
}

async function main() {
    try {
        if (!process.env.ADMIN_PASSWORD || !process.env.EMPLOYEE_PASSWORD) {
            throw new Error('Set ADMIN_PASSWORD and EMPLOYEE_PASSWORD in .env before creating accounts.');
        }
        if (process.env.ADMIN_PASSWORD.length < 12 || process.env.EMPLOYEE_PASSWORD.length < 12) {
            throw new Error('ADMIN_PASSWORD and EMPLOYEE_PASSWORD must each contain at least 12 characters.');
        }

        await mongoose.connect(process.env.MONGO_URI);

        await createUser({
            name: 'Mobixa Admin',
            email: (process.env.ADMIN_EMAIL || 'admin@mobixa.com').toLowerCase(),
            username: 'admin',
            password: process.env.ADMIN_PASSWORD,
            role: 'admin',
            designation: 'Administrator'
        });

        await createUser({
            name: 'Mobixa Employee',
            email: (process.env.EMPLOYEE_EMAIL || 'employee@mobixa.com').toLowerCase(),
            username: 'employee',
            password: process.env.EMPLOYEE_PASSWORD,
            role: 'employee',
            designation: 'Sales Executive'
        });
    } catch (error) {
        console.error('Account setup failed:', error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

main();
