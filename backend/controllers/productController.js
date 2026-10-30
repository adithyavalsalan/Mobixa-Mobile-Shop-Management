const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');
const Sale = require('../models/Sale');

// @desc    Get all products with filters & search
// @route   GET /api/products
// @access  Private
const getProducts = async (req, res, next) => {
    try {
        const { search, category, brand, stockStatus, status = 'active', sort = '-createdAt', page = 1, limit = 100 } = req.query;
        const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 100));

        const query = {};

        if (status && status !== 'all') {
            query.status = status;
        }

        if (category && category !== 'all') {
            query.category = new RegExp(`^${category}$`, 'i');
        }

        if (brand && brand !== 'all') {
            query.brand = new RegExp(`^${brand}$`, 'i');
        }

        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            query.$or = [
                { name: regex },
                { brand: regex },
                { sku: regex },
                { modelName: regex }
            ];
        }

        let products = await Product.find(query).sort(sort).lean();

        // Stock status filter: in, low, out
        if (stockStatus) {
            if (stockStatus === 'in') {
                products = products.filter(p => p.stock > p.minStockLevel);
            } else if (stockStatus === 'low') {
                products = products.filter(p => p.stock > 0 && p.stock <= p.minStockLevel);
            } else if (stockStatus === 'out') {
                products = products.filter(p => p.stock === 0);
            }
        }

        // Summary counts
        const allProducts = await Product.find({ status: 'active' }).lean();
        const totalProducts = allProducts.length;
        const lowStockCount = allProducts.filter(p => p.stock > 0 && p.stock <= p.minStockLevel).length;
        const outOfStockCount = allProducts.filter(p => p.stock === 0).length;
        const inStockCount = allProducts.filter(p => p.stock > p.minStockLevel).length;
        const totalInventoryValue = allProducts.reduce((sum, p) => sum + (p.purchaseCost * p.stock), 0);

        const totalResults = products.length;
        products = products.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);

        return res.json({
            success: true,
            count: products.length,
            pagination: {
                page: pageNumber,
                limit: pageSize,
                totalResults,
                totalPages: Math.ceil(totalResults / pageSize)
            },
            summary: {
                totalProducts,
                inStockCount,
                lowStockCount,
                outOfStockCount,
                totalInventoryValue
            },
            data: products
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Private
const getProductById = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        return res.json({ success: true, data: product });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new product
// @route   POST /api/products
// @access  Private (Admin or authorized)
const createProduct = async (req, res, next) => {
    try {
        const {
            name, sku, brand, modelName, category, description,
            purchaseCost, sellingPrice, stock, minStockLevel,
            storage, color, imeiList, supplier
        } = req.body;

        if (!name || !sku || !brand || purchaseCost === undefined || sellingPrice === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Name, SKU, Brand, Purchase Cost, and Selling Price are required.'
            });
        }

        const existing = await Product.findOne({ sku: sku.trim().toUpperCase() });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: `Product with SKU '${sku.toUpperCase()}' already exists.`
            });
        }

        const parsedStock = Number(stock) || 0;
        const parsedCost = Number(purchaseCost);
        const parsedPrice = Number(sellingPrice);
        const parsedMin = Number(minStockLevel) >= 0 ? Number(minStockLevel) : 5;
        if (!Number.isInteger(parsedStock) || !Number.isInteger(parsedMin)) {
            return res.status(400).json({
                success: false,
                message: 'Stock and minimum stock level must be whole numbers.'
            });
        }

        // Process IMEI list if provided
        let processedImeis = [];
        if (Array.isArray(imeiList)) {
            processedImeis = imeiList.map(i => String(i).trim()).filter(Boolean);
        } else if (typeof imeiList === 'string' && imeiList.trim()) {
            processedImeis = imeiList.split(',').map(i => i.trim()).filter(Boolean);
        }

        const product = await Product.create({
            name: name.trim(),
            sku: sku.trim().toUpperCase(),
            brand: brand.trim(),
            modelName: modelName ? modelName.trim() : '',
            category: category || 'Smartphones',
            description: description ? description.trim() : '',
            purchaseCost: parsedCost,
            sellingPrice: parsedPrice,
            stock: parsedStock,
            minStockLevel: parsedMin,
            storage: storage || '',
            color: color || '',
            imeiList: processedImeis,
            supplier: supplier || { name: '', contact: '' }
        });

        // Record initial inventory movement if stock > 0
        if (parsedStock > 0) {
            await InventoryMovement.create({
                product: product._id,
                type: 'IN',
                quantity: parsedStock,
                previousStock: 0,
                newStock: parsedStock,
                reason: 'Initial stock intake upon product creation',
                reference: `INIT-${product.sku}`,
                performedBy: req.user ? req.user._id : null
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: product
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update an existing product
// @route   PUT /api/products/:id
// @access  Private
const updateProduct = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const {
            name, sku, brand, modelName, category, description,
            purchaseCost, sellingPrice, minStockLevel,
            storage, color, imeiList, supplier, status
        } = req.body;

        if (sku && sku.trim().toUpperCase() !== product.sku) {
            const existing = await Product.findOne({
                sku: sku.trim().toUpperCase(),
                _id: { $ne: product._id }
            });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: `SKU '${sku.toUpperCase()}' is already in use by another product.`
                });
            }
            product.sku = sku.trim().toUpperCase();
        }

        if (name) product.name = name.trim();
        if (brand) product.brand = brand.trim();
        if (modelName !== undefined) product.modelName = modelName.trim();
        if (category) product.category = category;
        if (description !== undefined) product.description = description.trim();
        if (purchaseCost !== undefined) product.purchaseCost = Number(purchaseCost);
        if (sellingPrice !== undefined) product.sellingPrice = Number(sellingPrice);
        if (minStockLevel !== undefined) product.minStockLevel = Number(minStockLevel);
        if (storage !== undefined) product.storage = storage.trim();
        if (color !== undefined) product.color = color.trim();
        if (status) product.status = status;
        if (supplier) product.supplier = supplier;

        if (imeiList !== undefined) {
            if (Array.isArray(imeiList)) {
                product.imeiList = imeiList.map(i => String(i).trim()).filter(Boolean);
            } else if (typeof imeiList === 'string') {
                product.imeiList = imeiList.split(',').map(i => i.trim()).filter(Boolean);
            }
        }

        await product.save();

        return res.json({
            success: true,
            message: 'Product updated successfully',
            data: product
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete or archive a product
// @route   DELETE /api/products/:id
// @access  Private (Admin)
const deleteProduct = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Check if product was ever sold
        const hasSales = await Sale.exists({ 'items.product': product._id });
        if (hasSales) {
            // Archive rather than delete to preserve sales history
            product.status = 'archived';
            await product.save();
            return res.json({
                success: true,
                message: 'Product has associated sales records and was archived safely instead of deleted.'
            });
        }

        await Product.findByIdAndDelete(product._id);
        return res.json({
            success: true,
            message: 'Product deleted permanently.'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct
};
