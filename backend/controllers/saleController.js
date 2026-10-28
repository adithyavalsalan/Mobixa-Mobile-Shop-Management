const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const InventoryMovement = require('../models/InventoryMovement');
const Settings = require('../models/Settings');

// Generate unique sequential invoice number
const generateInvoiceNumber = async () => {
    const settings = await Settings.findOne() || { invoicePrefix: 'MOB' };
    const prefix = settings.invoicePrefix || 'MOB';
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const countToday = await Sale.countDocuments({
        createdAt: {
            $gte: new Date(today.setHours(0, 0, 0, 0)),
            $lte: new Date(today.setHours(23, 59, 59, 999))
        }
    });

    const seq = String(countToday + 1).padStart(4, '0');
    return `${prefix}-${dateStr}-${seq}`;
};

// @desc    Create a new sale transaction
// @route   POST /api/sales
// @access  Private
const createSale = async (req, res, next) => {
    try {
        const {
            customerName,
            customerPhone,
            customerEmail,
            items,
            discount = 0,
            paymentMethod = 'Cash'
        } = req.body;

        if (!customerName || !customerName.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Customer name is required'
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Sale must contain at least one product item.'
            });
        }

        // Fetch settings for tax rate
        const settings = await Settings.findOne() || {};
        const taxRate = typeof settings.defaultTaxRate === 'number' ? settings.defaultTaxRate : 18;

        // Process line items & validate against DB
        const processedItems = [];
        let subtotal = 0;

        // First pass: validate all items and stock
        for (const item of items) {
            const product = await Product.findById(item.productId || item.product);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: `Product not found: ${item.productId || item.name}`
                });
            }

            if (product.status === 'archived') {
                return res.status(400).json({
                    success: false,
                    message: `Product '${product.name}' is archived and cannot be sold.`
                });
            }

            const qty = Number(item.quantity);
            if (isNaN(qty) || qty <= 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid quantity for ${product.name}`
                });
            }

            if (product.stock < qty) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for '${product.name}'. Requested: ${qty}, Available: ${product.stock}`
                });
            }

            const unitPrice = product.sellingPrice;
            const unitCost = product.purchaseCost;
            const lineTotal = unitPrice * qty;
            subtotal += lineTotal;

            processedItems.push({
                product: product._id,
                name: product.name,
                sku: product.sku,
                imei: item.imei || '',
                unitCost,
                unitPrice,
                quantity: qty,
                total: lineTotal
            });
        }

        const parsedDiscount = Math.max(0, Number(discount) || 0);
        if (parsedDiscount > subtotal) {
            return res.status(400).json({
                success: false,
                message: 'Discount cannot exceed subtotal amount.'
            });
        }

        const taxableAmount = Math.max(0, subtotal - parsedDiscount);
        const taxAmount = Math.round((taxableAmount * (taxRate / 100)) * 100) / 100;
        const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

        const invoiceNumber = await generateInvoiceNumber();

        // Customer find or create
        let customerDoc = null;
        if (customerPhone && customerPhone.trim()) {
            customerDoc = await Customer.findOne({ phone: customerPhone.trim() });
            if (!customerDoc) {
                customerDoc = await Customer.create({
                    name: customerName.trim(),
                    phone: customerPhone.trim(),
                    email: customerEmail ? customerEmail.trim() : '',
                    totalPurchases: 1,
                    totalSpent: grandTotal
                });
            } else {
                customerDoc.totalPurchases = (customerDoc.totalPurchases || 0) + 1;
                customerDoc.totalSpent = (customerDoc.totalSpent || 0) + grandTotal;
                if (!customerDoc.email && customerEmail) customerDoc.email = customerEmail.trim();
                await customerDoc.save();
            }
        }

        // Deduct inventory and record movements
        for (const item of processedItems) {
            const prod = await Product.findById(item.product);
            const prevStock = prod.stock;
            const newStock = Math.max(0, prevStock - item.quantity);

            prod.stock = newStock;
            if (item.imei && prod.imeiList && prod.imeiList.includes(item.imei)) {
                prod.imeiList = prod.imeiList.filter(i => i !== item.imei);
            }
            await prod.save();

            await InventoryMovement.create({
                product: prod._id,
                type: 'SALE',
                quantity: -item.quantity,
                previousStock: prevStock,
                newStock: newStock,
                reason: `Sale ${invoiceNumber}`,
                reference: invoiceNumber,
                performedBy: req.user ? req.user._id : null
            });
        }

        const sale = await Sale.create({
            invoiceNumber,
            customer: customerDoc ? customerDoc._id : null,
            customerName: customerName.trim(),
            customerPhone: customerPhone ? customerPhone.trim() : '',
            soldBy: req.user ? req.user._id : null,
            items: processedItems,
            subtotal,
            discount: parsedDiscount,
            taxRate,
            taxAmount,
            grandTotal,
            paymentMethod,
            paymentStatus: 'Paid',
            saleStatus: 'Completed'
        });

        return res.status(201).json({
            success: true,
            message: 'Sale completed successfully',
            data: sale
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all sales with filters
// @route   GET /api/sales
// @access  Private
const getSales = async (req, res, next) => {
    try {
        const { search, status, paymentMethod, startDate, endDate, sort = '-createdAt', limit = 100 } = req.query;
        const query = {};

        if (status && status !== 'all') {
            query.saleStatus = new RegExp(`^${status}$`, 'i');
        }

        if (paymentMethod && paymentMethod !== 'all') {
            query.paymentMethod = paymentMethod;
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            query.$or = [
                { invoiceNumber: regex },
                { customerName: regex },
                { customerPhone: regex },
                { 'items.name': regex }
            ];
        }

        const sales = await Sale.find(query)
            .sort(sort)
            .limit(Number(limit))
            .populate('soldBy', 'name email role')
            .lean();

        // Calculate summary metrics
        const allCompletedSales = await Sale.find({ saleStatus: 'Completed' }).lean();
        const totalSalesCount = allCompletedSales.length;
        const totalRevenue = allCompletedSales.reduce((sum, s) => sum + s.grandTotal, 0);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todaySales = allCompletedSales.filter(s => new Date(s.createdAt) >= todayStart);
        const todayRevenue = todaySales.reduce((sum, s) => sum + s.grandTotal, 0);

        return res.json({
            success: true,
            count: sales.length,
            summary: {
                totalSalesCount,
                totalRevenue,
                todaySalesCount: todaySales.length,
                todayRevenue
            },
            data: sales
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get sale by ID or invoice number
// @route   GET /api/sales/:id
// @access  Private
const getSaleById = async (req, res, next) => {
    try {
        const { id } = req.params;
        let sale;
        if (id.match(/^[0-9a-fA-F]{24}$/)) {
            sale = await Sale.findById(id).populate('soldBy', 'name email role').populate('customer');
        } else {
            sale = await Sale.findOne({ invoiceNumber: id.toUpperCase() }).populate('soldBy', 'name email role').populate('customer');
        }

        if (!sale) {
            return res.status(404).json({ success: false, message: 'Sale invoice not found' });
        }

        const settings = await Settings.findOne() || {};

        return res.json({
            success: true,
            data: sale,
            settings: {
                shopName: settings.shopName,
                tagline: settings.tagline,
                phone: settings.phone,
                email: settings.email,
                address: settings.address,
                currency: settings.currency,
                invoiceFooter: settings.invoiceFooter
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Cancel sale and restore stock
// @route   POST /api/sales/:id/cancel
// @access  Private (Admin or authorized)
const cancelSale = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const sale = await Sale.findById(id);
        if (!sale) {
            return res.status(404).json({ success: false, message: 'Sale not found' });
        }

        if (sale.saleStatus === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Sale is already cancelled.' });
        }

        // Restore inventory for each item
        for (const item of sale.items) {
            const prod = await Product.findById(item.product);
            if (prod) {
                const prevStock = prod.stock;
                const newStock = prevStock + item.quantity;
                prod.stock = newStock;
                if (item.imei && !prod.imeiList.includes(item.imei)) {
                    prod.imeiList.push(item.imei);
                }
                await prod.save();

                await InventoryMovement.create({
                    product: prod._id,
                    type: 'RETURN',
                    quantity: item.quantity,
                    previousStock: prevStock,
                    newStock: newStock,
                    reason: `Cancellation reversal for invoice ${sale.invoiceNumber}: ${reason || 'Customer return'}`,
                    reference: sale.invoiceNumber,
                    performedBy: req.user ? req.user._id : null
                });
            }
        }

        // Adjust customer totals
        if (sale.customer) {
            const customer = await Customer.findById(sale.customer);
            if (customer) {
                customer.totalPurchases = Math.max(0, (customer.totalPurchases || 1) - 1);
                customer.totalSpent = Math.max(0, (customer.totalSpent || sale.grandTotal) - sale.grandTotal);
                await customer.save();
            }
        }

        sale.saleStatus = 'Cancelled';
        sale.cancellationReason = reason || 'Customer cancellation/return';
        sale.cancelledBy = req.user ? req.user._id : null;
        sale.cancelledAt = new Date();
        await sale.save();

        return res.json({
            success: true,
            message: `Sale ${sale.invoiceNumber} has been cancelled and stock has been restored.`,
            data: sale
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createSale,
    getSales,
    getSaleById,
    cancelSale
};
