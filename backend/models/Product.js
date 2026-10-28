const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true
    },
    sku: {
        type: String,
        required: [true, 'SKU is required'],
        unique: true,
        uppercase: true,
        trim: true
    },
    brand: {
        type: String,
        required: [true, 'Brand is required'],
        trim: true
    },
    modelName: {
        type: String,
        trim: true,
        default: ''
    },
    category: {
        type: String,
        enum: ['Smartphones', 'Accessories', 'Tablets', 'Wearables', 'Other'],
        default: 'Smartphones'
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    purchaseCost: {
        type: Number,
        required: [true, 'Purchase cost is required'],
        min: [0, 'Purchase cost must be positive']
    },
    sellingPrice: {
        type: Number,
        required: [true, 'Selling price is required'],
        min: [0, 'Selling price must be positive']
    },
    stock: {
        type: Number,
        required: [true, 'Stock quantity is required'],
        min: [0, 'Stock cannot be negative'],
        default: 0
    },
    minStockLevel: {
        type: Number,
        default: 5,
        min: [0, 'Minimum stock level must be positive']
    },
    storage: {
        type: String,
        trim: true,
        default: ''
    },
    color: {
        type: String,
        trim: true,
        default: ''
    },
    imeiList: [{
        type: String,
        trim: true
    }],
    supplier: {
        name: { type: String, default: '' },
        contact: { type: String, default: '' }
    },
    status: {
        type: String,
        enum: ['active', 'archived'],
        default: 'active'
    }
}, {
    timestamps: true
});

productSchema.index({ name: 'text', brand: 'text', sku: 'text', modelName: 'text' });

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
