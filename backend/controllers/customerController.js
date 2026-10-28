const Customer = require('../models/Customer');
const Sale = require('../models/Sale');

// @desc    Get all customers with search & metrics
// @route   GET /api/customers
// @access  Private
const getCustomers = async (req, res, next) => {
    try {
        const { search, sort = '-createdAt', limit = 100 } = req.query;
        const query = {};

        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            query.$or = [
                { name: regex },
                { phone: regex },
                { email: regex }
            ];
        }

        const customers = await Customer.find(query)
            .sort(sort)
            .limit(Number(limit))
            .lean();

        const totalCustomers = await Customer.countDocuments();
        const allCusts = await Customer.find().lean();
        const totalRevenueFromCustomers = allCusts.reduce((sum, c) => sum + (c.totalSpent || 0), 0);

        return res.json({
            success: true,
            count: customers.length,
            summary: {
                totalCustomers,
                totalRevenueFromCustomers
            },
            data: customers
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single customer profile with sales history
// @route   GET /api/customers/:id
// @access  Private
const getCustomerById = async (req, res, next) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        const sales = await Sale.find({
            $or: [{ customer: customer._id }, { customerPhone: customer.phone }]
        }).sort({ createdAt: -1 });

        return res.json({
            success: true,
            data: {
                customer,
                purchaseHistory: sales
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new customer
// @route   POST /api/customers
// @access  Private
const createCustomer = async (req, res, next) => {
    try {
        const { name, phone, email, address, notes } = req.body;

        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Customer name and phone number are required.'
            });
        }

        const existing = await Customer.findOne({ phone: phone.trim() });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: `A customer with phone number ${phone.trim()} already exists (${existing.name}).`
            });
        }

        const customer = await Customer.create({
            name: name.trim(),
            phone: phone.trim(),
            email: email ? email.trim() : '',
            address: address ? address.trim() : '',
            notes: notes ? notes.trim() : ''
        });

        return res.status(201).json({
            success: true,
            message: 'Customer added successfully',
            data: customer
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update customer details
// @route   PUT /api/customers/:id
// @access  Private
const updateCustomer = async (req, res, next) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        const { name, phone, email, address, notes } = req.body;

        if (phone && phone.trim() !== customer.phone) {
            const existing = await Customer.findOne({
                phone: phone.trim(),
                _id: { $ne: customer._id }
            });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: `Phone number ${phone.trim()} is already used by customer ${existing.name}.`
                });
            }
            customer.phone = phone.trim();
        }

        if (name) customer.name = name.trim();
        if (email !== undefined) customer.email = email.trim();
        if (address !== undefined) customer.address = address.trim();
        if (notes !== undefined) customer.notes = notes.trim();

        await customer.save();

        return res.json({
            success: true,
            message: 'Customer updated successfully',
            data: customer
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private (Admin)
const deleteCustomer = async (req, res, next) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        const hasSales = await Sale.exists({ customer: customer._id });
        if (hasSales) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete customer because previous sale records are attached to this account.'
            });
        }

        await Customer.findByIdAndDelete(customer._id);
        return res.json({
            success: true,
            message: 'Customer deleted successfully.'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deleteCustomer
};
