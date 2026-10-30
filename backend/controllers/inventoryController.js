const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');

// @desc    Get inventory summary and stock list
// @route   GET /api/inventory
// @access  Private
const getInventory = async (req, res, next) => {
    try {
        const { search, category, status } = req.query;

        const query = { status: 'active' };

        if (category && category !== 'all') {
            query.category = new RegExp(`^${category}$`, 'i');
        }

        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            query.$or = [
                { name: regex },
                { sku: regex },
                { brand: regex }
            ];
        }

        let products = await Product.find(query).sort({ stock: 1 }).lean();

        if (status) {
            if (status === 'in') {
                products = products.filter(p => p.stock > p.minStockLevel);
            } else if (status === 'low') {
                products = products.filter(p => p.stock > 0 && p.stock <= p.minStockLevel);
            } else if (status === 'out') {
                products = products.filter(p => p.stock === 0);
            }
        }

        const totalItemsInStock = products.reduce((acc, p) => acc + p.stock, 0);
        const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= p.minStockLevel).length;
        const outOfStockCount = products.filter(p => p.stock === 0).length;

        return res.json({
            success: true,
            summary: {
                totalProducts: products.length,
                totalUnits: totalItemsInStock,
                lowStockCount,
                outOfStockCount
            },
            data: products
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Stock In (Receive new inventory)
// @route   POST /api/inventory/stock-in
// @access  Private
const stockIn = async (req, res, next) => {
    try {
        const { productId, quantity, reason, reference, imeis } = req.body;

        const qty = Number(quantity);
        if (!productId || !Number.isInteger(qty) || qty <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid Product ID and quantity greater than 0 are required.'
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const prevStock = product.stock;
        const newStock = prevStock + qty;

        product.stock = newStock;

        // If IMEIs provided, append to product.imeiList
        if (Array.isArray(imeis) && imeis.length > 0) {
            product.imeiList = [...(product.imeiList || []), ...imeis.map(i => String(i).trim())];
        }

        await product.save();

        const movement = await InventoryMovement.create({
            product: product._id,
            type: 'IN',
            quantity: qty,
            previousStock: prevStock,
            newStock: newStock,
            reason: reason || 'Stock replenishment',
            reference: reference || '',
            performedBy: req.user ? req.user._id : null
        });

        return res.json({
            success: true,
            message: `Successfully added ${qty} units to ${product.name}`,
            data: {
                product,
                movement
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Stock adjustment (Correction/damaged/audit)
// @route   POST /api/inventory/adjust
// @access  Private (Admin or authorized)
const adjustStock = async (req, res, next) => {
    try {
        const { productId, newQuantity, reason } = req.body;

        const targetQty = Number(newQuantity);
        if (!productId || !Number.isInteger(targetQty) || targetQty < 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid Product ID and non-negative quantity are required.'
            });
        }

        if (!reason || !reason.trim()) {
            return res.status(400).json({
                success: false,
                message: 'A clear reason is required for stock adjustment audits.'
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const prevStock = product.stock;
        const diff = targetQty - prevStock;

        if (diff === 0) {
            return res.status(400).json({
                success: false,
                message: 'New stock is identical to current stock. No adjustment needed.'
            });
        }

        product.stock = targetQty;
        await product.save();

        const movement = await InventoryMovement.create({
            product: product._id,
            type: 'ADJUSTMENT',
            quantity: diff,
            previousStock: prevStock,
            newStock: targetQty,
            reason: reason.trim(),
            performedBy: req.user ? req.user._id : null
        });

        return res.json({
            success: true,
            message: `Stock for ${product.name} adjusted from ${prevStock} to ${targetQty}`,
            data: {
                product,
                movement
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get inventory movement history
// @route   GET /api/inventory/movements
// @access  Private
const getMovements = async (req, res, next) => {
    try {
        const { productId, type, limit = 50 } = req.query;
        const query = {};

        if (productId) query.product = productId;
        if (type) query.type = type.toUpperCase();

        const movements = await InventoryMovement.find(query)
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .populate('product', 'name sku brand')
            .populate('performedBy', 'name email role')
            .lean();

        return res.json({
            success: true,
            count: movements.length,
            data: movements
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getInventory,
    stockIn,
    adjustStock,
    getMovements
};
