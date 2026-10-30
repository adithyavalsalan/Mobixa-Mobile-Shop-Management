const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '../../.env');
const envExamplePath = path.join(__dirname, '../../.env.example');
if (process.env.NODE_ENV !== 'production' && !fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
}
require('dotenv').config({ path: envPath });
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');

const User = require('../models/User');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const InventoryMovement = require('../models/InventoryMovement');
const Settings = require('../models/Settings');

const seedData = async () => {
    try {
        const requiredSecrets = ['JWT_SECRET', 'ADMIN_PASSWORD', 'EMPLOYEE_PASSWORD'];
        const missingSecrets = requiredSecrets.filter(key => !process.env[key]);
        if (missingSecrets.length > 0) {
            throw new Error(`Configure ${missingSecrets.join(', ')} in .env before seeding.`);
        }
        if (process.env.JWT_SECRET.length < 32) {
            throw new Error('JWT_SECRET must contain at least 32 characters.');
        }
        if (process.env.ADMIN_PASSWORD.length < 12 || process.env.EMPLOYEE_PASSWORD.length < 12) {
            throw new Error('ADMIN_PASSWORD and EMPLOYEE_PASSWORD must each contain at least 12 characters.');
        }

        await connectDB();
        console.log('[Seed] Connected to database. Preparing default records...');

        // 1. Settings
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({
                shopName: 'MOBIXA Mobile Hub',
                tagline: 'SMART • SIMPLE • POWERFUL',
                phone: '+91 98765 43210',
                email: 'support@mobixa.com',
                address: 'Tech Plaza, MG Road, Ernakulam, Kerala 682016',
                currency: '₹',
                currencyCode: 'INR',
                defaultTaxRate: 18,
                invoicePrefix: 'MOB',
                invoiceFooter: 'Thank you for shopping with Mobixa! 1 Year official warranty. Keep this receipt safe.',
                lowStockThresholdDefault: 5
            });
            console.log('[Seed] Created default settings.');
        }

        // 2. Default Administrator
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@mobixa.com';
        const adminPass = process.env.ADMIN_PASSWORD;
        let adminUser = await User.findOne({ email: adminEmail });
        if (!adminUser) {
            adminUser = await User.create({
                name: 'System Admin',
                email: adminEmail,
                username: 'admin',
                phone: '+91 98765 43210',
                password: adminPass,
                role: 'admin',
                designation: 'General Manager',
                status: 'active'
            });
            console.log(`[Seed] Created admin account: ${adminEmail}`);
        } else {
            console.log(`[Seed] Admin account already exists: ${adminEmail}`);
        }

        // 3. Default Employee
        const empEmail = process.env.EMPLOYEE_EMAIL || 'employee@mobixa.com';
        const empPass = process.env.EMPLOYEE_PASSWORD;
        let empUser = await User.findOne({ email: empEmail });
        if (!empUser) {
            empUser = await User.create({
                name: 'Rahul Sharma',
                email: empEmail,
                username: 'employee',
                phone: '+91 98765 12345',
                password: empPass,
                role: 'employee',
                designation: 'Sales Executive',
                salary: 28000,
                status: 'active'
            });
            console.log(`[Seed] Created employee account: ${empEmail}`);
        } else {
            console.log(`[Seed] Employee account already exists: ${empEmail}`);
        }

        // 4. Products
        const initialProducts = [
            {
                name: 'iPhone 15',
                sku: 'IPH-15-128',
                brand: 'Apple',
                modelName: 'A3090',
                category: 'Smartphones',
                description: 'Super Retina XDR display, Dynamic Island, 48MP Main camera, USB-C',
                purchaseCost: 62000,
                sellingPrice: 71999,
                stock: 14,
                minStockLevel: 5,
                storage: '128GB',
                color: 'Black',
                imeiList: ['352099102938471', '352099102938472', '352099102938473']
            },
            {
                name: 'Galaxy S24',
                sku: 'SAM-S24-256',
                brand: 'Samsung',
                modelName: 'SM-S921B',
                category: 'Smartphones',
                description: 'Galaxy AI, Dynamic AMOLED 2X, Snapdragon 8 Gen 3',
                purchaseCost: 65000,
                sellingPrice: 79999,
                stock: 12,
                minStockLevel: 5,
                storage: '256GB',
                color: 'Cobalt Violet',
                imeiList: ['358911029384751', '358911029384752']
            },
            {
                name: 'OnePlus 12',
                sku: 'OP-12-256',
                brand: 'OnePlus',
                modelName: 'CPH2581',
                category: 'Smartphones',
                description: '4th Gen Hasselblad Camera, 5400 mAh Battery, 100W SUPERVOOC',
                purchaseCost: 52000,
                sellingPrice: 64999,
                stock: 8,
                minStockLevel: 5,
                storage: '256GB',
                color: 'Silky Black',
                imeiList: ['864920059283741']
            },
            {
                name: 'Pixel 9',
                sku: 'GOOG-P9-128',
                brand: 'Google',
                modelName: 'GUR25',
                category: 'Smartphones',
                description: 'Google Tensor G4, Advanced AI, 50MP Camera with Super Res Zoom',
                purchaseCost: 64000,
                sellingPrice: 74999,
                stock: 9,
                minStockLevel: 5,
                storage: '128GB',
                color: 'Porcelain',
                imeiList: ['354890019283745']
            },
            {
                name: 'Redmi Note 14',
                sku: 'MI-RN14-128',
                brand: 'Xiaomi',
                modelName: '24090RA29G',
                category: 'Smartphones',
                description: '120Hz AMOLED display, 50MP Sony Camera, 5000mAh Battery',
                purchaseCost: 14000,
                sellingPrice: 17999,
                stock: 4, // low stock!
                minStockLevel: 5,
                storage: '128GB',
                color: 'Prism Blue',
                imeiList: ['862910048291024']
            },
            {
                name: 'AirPods Pro (2nd Gen)',
                sku: 'ACC-APP2-W',
                brand: 'Apple',
                modelName: 'MTJV3HN/A',
                category: 'Accessories',
                description: 'Active Noise Cancellation, Transparency mode, MagSafe Case (USB-C)',
                purchaseCost: 19000,
                sellingPrice: 24900,
                stock: 15,
                minStockLevel: 4,
                storage: 'N/A',
                color: 'White',
                imeiList: []
            }
        ];

        for (const p of initialProducts) {
            const exists = await Product.findOne({ sku: p.sku });
            if (!exists) {
                const prod = await Product.create(p);
                await InventoryMovement.create({
                    product: prod._id,
                    type: 'IN',
                    quantity: prod.stock,
                    previousStock: 0,
                    newStock: prod.stock,
                    reason: 'Initial setup seed intake',
                    performedBy: adminUser._id
                });
                console.log(`[Seed] Created product: ${prod.name} (${prod.sku})`);
            }
        }

        // 5. Default Customers
        const initialCustomers = [
            {
                name: 'Arjun Nair',
                phone: '+91 94471 23456',
                email: 'arjun.nair@example.com',
                address: 'Kakkanad, Kochi',
                totalPurchases: 2,
                totalSpent: 96998
            },
            {
                name: 'Sneha Patel',
                phone: '+91 98200 98765',
                email: 'sneha.p@example.com',
                address: 'Marine Drive, Kochi',
                totalPurchases: 1,
                totalSpent: 71999
            },
            {
                name: 'Mohammed Fasil',
                phone: '+91 97450 11223',
                email: 'fasil.m@example.com',
                address: 'Edappally, Kochi',
                totalPurchases: 1,
                totalSpent: 17999
            }
        ];

        for (const c of initialCustomers) {
            const exists = await Customer.findOne({ phone: c.phone });
            if (!exists) {
                await Customer.create(c);
                console.log(`[Seed] Created customer: ${c.name}`);
            }
        }

        console.log('[Seed] Seeding completed successfully!');
    } catch (error) {
        console.error('[Seed] Error during seeding:', error);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect().catch(error => {
            console.error('[Seed] Failed to disconnect from database:', error.message);
            process.exitCode = 1;
        });
    }
};

seedData();
