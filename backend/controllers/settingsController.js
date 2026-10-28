const Settings = require('../models/Settings');

// @desc    Get store settings
// @route   GET /api/settings
// @access  Public / Private
const getSettings = async (req, res, next) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }
        return res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update store settings
// @route   PUT /api/settings
// @access  Private (Admin)
const updateSettings = async (req, res, next) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
        }

        const {
            shopName,
            tagline,
            phone,
            email,
            address,
            currency,
            currencyCode,
            defaultTaxRate,
            invoicePrefix,
            invoiceFooter,
            lowStockThresholdDefault
        } = req.body;

        if (shopName) settings.shopName = shopName.trim();
        if (tagline !== undefined) settings.tagline = tagline.trim();
        if (phone !== undefined) settings.phone = phone.trim();
        if (email !== undefined) settings.email = email.trim();
        if (address !== undefined) settings.address = address.trim();
        if (currency !== undefined) settings.currency = currency.trim();
        if (currencyCode !== undefined) settings.currencyCode = currencyCode.trim();
        if (defaultTaxRate !== undefined) settings.defaultTaxRate = Number(defaultTaxRate);
        if (invoicePrefix !== undefined) settings.invoicePrefix = invoicePrefix.trim().toUpperCase();
        if (invoiceFooter !== undefined) settings.invoiceFooter = invoiceFooter.trim();
        if (lowStockThresholdDefault !== undefined) settings.lowStockThresholdDefault = Number(lowStockThresholdDefault);

        await settings.save();

        return res.json({
            success: true,
            message: 'Settings updated successfully.',
            data: settings
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getSettings,
    updateSettings
};
