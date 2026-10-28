const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const User = require('../models/User');

// @desc    Generate report data
// @route   GET /api/reports/generate
// @access  Private (Admin)
const generateReport = async (req, res, next) => {
    try {
        const { reportType = 'sales', startDate, endDate } = req.query;

        const dateQuery = {};
        if (startDate || endDate) {
            dateQuery.createdAt = {};
            if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                dateQuery.createdAt.$lte = end;
            }
        }

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
        const { reportType = 'sales', startDate, endDate } = req.query;

        let filename = `mobixa-${reportType}-report-${new Date().toISOString().slice(0, 10)}.csv`;
        let csvContent = '';

        if (reportType === 'inventory') {
            const products = await Product.find({ status: 'active' }).lean();
            csvContent = 'Name,SKU,Brand,Category,Cost Price,Selling Price,Stock,Status\n';
            products.forEach(p => {
                csvContent += `"${p.name}","${p.sku}","${p.brand}","${p.category}",${p.purchaseCost},${p.sellingPrice},${p.stock},"${p.stock <= p.minStockLevel ? 'Low Stock' : 'In Stock'}"\n`;
            });
        } else if (reportType === 'customers') {
            const customers = await Customer.find().lean();
            csvContent = 'Name,Phone,Email,Total Purchases,Total Spent\n';
            customers.forEach(c => {
                csvContent += `"${c.name}","${c.phone}","${c.email || ''}",${c.totalPurchases || 0},${c.totalSpent || 0}\n`;
            });
        } else {
            const dateQuery = {};
            if (startDate || endDate) {
                dateQuery.createdAt = {};
                if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    dateQuery.createdAt.$lte = end;
                }
            }
            const sales = await Sale.find(dateQuery).sort({ createdAt: -1 }).populate('soldBy', 'name').lean();
            csvContent = 'Invoice Number,Date,Customer,Product(s),Subtotal,Discount,Tax,Grand Total,Payment Method,Status\n';
            sales.forEach(s => {
                const productNames = (s.items || []).map(i => `${i.name} (x${i.quantity})`).join('; ');
                const date = new Date(s.createdAt).toLocaleDateString();
                csvContent += `"${s.invoiceNumber}","${date}","${s.customerName}","${productNames}",${s.subtotal},${s.discount},${s.taxAmount},${s.grandTotal},"${s.paymentMethod}","${s.saleStatus}"\n`;
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
