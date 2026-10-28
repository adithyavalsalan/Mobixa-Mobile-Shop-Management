const mongoose = require('mongoose');

const inventoryMovementSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product reference is required']
    },
    type: {
        type: String,
        enum: ['IN', 'OUT', 'ADJUSTMENT', 'SALE', 'RETURN'],
        required: [true, 'Movement type is required']
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity delta is required']
    },
    previousStock: {
        type: Number,
        required: true
    },
    newStock: {
        type: Number,
        required: true
    },
    reason: {
        type: String,
        trim: true,
        default: ''
    },
    reference: {
        type: String,
        trim: true,
        default: ''
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.models.InventoryMovement || mongoose.model('InventoryMovement', inventoryMovementSchema);
