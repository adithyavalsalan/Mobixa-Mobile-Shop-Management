const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const User = require('../models/User');

const reportTypes = new Set(['sales', 'inventory', 'customers', 'employees']);

const parseReportFilters = (query, res) => {
    const reportType = query.reportType || 'sales';
    if (!reportTypes.has(reportType)) {
        res.status(400).json({ success: false, message: 'Invalid report type.' });
        return null;
    }

    const dateQuery = {};
    const dateRange = {};
    for (const [parameter, operator, time] of [
        ['startDate', '$gte', 'T00:00:00.000Z'],
        ['endDate', '$lte', 'T23:59:59.999Z']
    ]) {
        const value = query[parameter];
        if (!value) continue;
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            res.status(400).json({ success: false, message: `${parameter} must use YYYY-MM-DD format.` });
            return null;
        }
        const date = new Date(`${value}${time}`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
            res.status(400).json({ success: false, message: `${parameter} is not a valid date.` });
            return null;
        }
        dateRange[operator] = date;
    }

    if (dateRange.$gte && dateRange.$lte && dateRange.$gte > dateRange.$lte) {
        res.status(400).json({ success: false, message: 'startDate must be on or before endDate.' });
        return null;
    }
    if (Object.keys(dateRange).length) dateQuery.createdAt = dateRange;

    return { reportType, dateQuery };
};

const csvCell = value => {
    let text = String(value ?? '');
    if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
};

// @desc    Generate report data
// @route   GET /api/reports/generate
// @access  Private (Admin)
const generateReport = async (req, res, next) => {
    try {
        const filters = parseReportFilters(req.query, res);
        if (!filters) return;
        const { reportType, dateQuery } = filters;

        if (reportType === 'inventory') {
            const products = await Product.find({ status: 'active' }).sort({ stock: 1 }).lean();
            const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
            const totalValuation = products.reduce((acc, p) => acc + (p.purchaseCost * p.stock), 0);
            const retailValuation = products.reduce((acc, p) => acc + (p.sellingPrice * p.stock), 0);

            return res.json({
                success: true,
                reportType: 'inventory',
                summary: {
                    totalProducts: products.length,
                    totalStock,
                    totalValuation,
                    potentialRetailValue: retailValuation,
                    estimatedMargin: retailValuation - totalValuation
                },
                data: products
            });
        }

        if (reportType === 'customers') {
            const customers = await Customer.find().sort({ totalSpent: -1 }).lean();
            const totalSpent = customers.reduce((acc, c) => acc + (c.totalSpent || 0), 0);

            return res.json({
                success: true,
                reportType: 'customers',
                summary: {
                    totalCustomers: customers.length,
                    totalSpent
                },
                data: customers
            });
        }

        if (reportType === 'employees') {
            const employees = await User.find({ status: 'active' }).select('-password').lean();
            const sales = await Sale.find({ saleStatus: 'Completed', ...dateQuery }).lean();

            const employeePerformance = employees.map(emp => {
                const empSales = sales.filter(s => String(s.soldBy) === String(emp._id));
                const revenue = empSales.reduce((acc, s) => acc + s.grandTotal, 0);
                return {
                    id: emp._id,
                    name: emp.name,
                    role: emp.role,
                    designation: emp.designation,
                    salesCount: empSales.length,
                    totalRevenue: revenue
                };
            }).sort((a, b) => b.totalRevenue - a.totalRevenue);

            return res.json({
                success: true,
                reportType: 'employees',
                data: employeePerformance
            });
        }

        // Default: Sales & Revenue report
        const sales = await Sale.find({ ...dateQuery })
            .sort({ createdAt: -1 })
            .populate('soldBy', 'name role')
            .lean();

        const completedSales = sales.filter(s => s.saleStatus === 'Completed');
        const grossSubtotal = completedSales.reduce((sum, s) => sum + s.subtotal, 0);
        const totalDiscount = completedSales.reduce((sum, s) => sum + s.discount, 0);
        const totalTax = completedSales.reduce((sum, s) => sum + s.taxAmount, 0);
        const netRevenue = completedSales.reduce((sum, s) => sum + s.grandTotal, 0);

        // Calculate Cost of Goods Sold (COGS) and Gross Profit
        let totalCOGS = 0;
        completedSales.forEach(s => {
            (s.items || []).forEach(item => {
                totalCOGS += (item.unitCost || 0) * (item.quantity || 1);
            });
        });

        const grossProfit = Math.max(0, netRevenue - totalTax - totalCOGS);

        return res.json({
            success: true,
            reportType: 'sales',
            summary: {
                totalTransactions: sales.length,
                completedTransactions: completedSales.length,
                cancelledTransactions: sales.length - completedSales.length,
                grossSubtotal,
                totalDiscount,
                totalTax,
                netRevenue,
                totalCOGS,
                grossProfit
            },
            data: sales
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Export report as CSV
// @route   GET /api/reports/export-csv
// @access  Private (Admin)
const exportCSV = async (req, res, next) => {
    try {
        const filters = parseReportFilters(req.query, res);
        if (!filters) return;
        const { reportType, dateQuery } = filters;
        const filename = `mobixa-${reportType}-report-${new Date().toISOString().slice(0, 10)}.csv`;
        let csvContent = '';

        if (reportType === 'inventory') {
            const products = await Product.find({ status: 'active' }).lean();
            csvContent = 'Name,SKU,Brand,Category,Cost Price,Selling Price,Stock,Status\n';
            products.forEach(p => {
                csvContent += [
                    p.name, p.sku, p.brand, p.category, p.purchaseCost, p.sellingPrice,
                    p.stock, p.stock <= p.minStockLevel ? 'Low Stock' : 'In Stock'
                ].map(csvCell).join(',') + '\n';
            });
        } else if (reportType === 'customers') {
            const customers = await Customer.find().lean();
            csvContent = 'Name,Phone,Email,Total Purchases,Total Spent\n';
            customers.forEach(c => {
                csvContent += [
                    c.name, c.phone, c.email, c.totalPurchases || 0, c.totalSpent || 0
                ].map(csvCell).join(',') + '\n';
            });
        } else {
            const sales = await Sale.find(dateQuery).sort({ createdAt: -1 }).populate('soldBy', 'name').lean();
            csvContent = 'Invoice Number,Date,Customer,Product(s),Subtotal,Discount,Tax,Grand Total,Payment Method,Status\n';
            sales.forEach(s => {
                const productNames = (s.items || []).map(i => `${i.name} (x${i.quantity})`).join('; ');
                const date = new Date(s.createdAt).toISOString().slice(0, 10);
                csvContent += [
                    s.invoiceNumber, date, s.customerName, productNames, s.subtotal,
                    s.discount, s.taxAmount, s.grandTotal, s.paymentMethod, s.saleStatus
                ].map(csvCell).join(',') + '\n';
            });
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(csvContent);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    generateReport,
    exportCSV
};
