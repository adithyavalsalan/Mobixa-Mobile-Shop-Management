const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    shopName: {
        type: String,
        default: 'Mobixa Mobile Store',
        trim: true
    },
    tagline: {
        type: String,
        default: 'Smart • Simple • Powerful',
        trim: true
    },
    phone: {
        type: String,
        default: '+91 98765 43210',
        trim: true
    },
    email: {
        type: String,
        default: 'contact@mobixa.com',
        trim: true
    },
    address: {
        type: String,
        default: 'Opp. City Center, MG Road, Ernakulam, Kerala',
        trim: true
    },
    currency: {
        type: String,
        default: '₹'
    },
    currencyCode: {
        type: String,
        default: 'INR'
    },
    defaultTaxRate: {
        type: Number,
        default: 18,
        min: 0,
        max: 100
    },
    invoicePrefix: {
        type: String,
        default: 'MOB',
        trim: true
    },
    invoiceFooter: {
        type: String,
        default: 'Thank you for choosing Mobixa! 1 Year official warranty. Keep this receipt safe.',
        trim: true
    },
    lowStockThresholdDefault: {
        type: Number,
        default: 5,
        min: 1
    }
}, {
    timestamps: true
});

module.exports = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
