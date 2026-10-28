const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Attendance = require('../models/Attendance');

// @desc    Get aggregate stats for Admin Dashboard
// @route   GET /api/dashboard/admin
// @access  Private (Admin)
const getAdminDashboard = async (req, res, next) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [
            totalProducts,
            products,
            totalCustomers,
            totalEmployees,
            allCompletedSales,
            recentSales
        ] = await Promise.all([
            Product.countDocuments({ status: 'active' }),
            Product.find({ status: 'active' }).select('name brand stock minStockLevel sellingPrice').lean(),
            Customer.countDocuments(),
            User.countDocuments({ status: 'active' }),
            Sale.find({ saleStatus: 'Completed' }).select('grandTotal subtotal discount createdAt paymentMethod items').lean(),
            Sale.find().sort({ createdAt: -1 }).limit(6).populate('soldBy', 'name role').lean()
        ]);

        const totalRevenue = allCompletedSales.reduce((acc, s) => acc + s.grandTotal, 0);
        const totalSalesCount = allCompletedSales.length;

        const todaySales = allCompletedSales.filter(s => new Date(s.createdAt) >= todayStart);
        const todayRevenue = todaySales.reduce((acc, s) => acc + s.grandTotal, 0);
        const todaySalesCount = todaySales.length;

        // Low stock products
        const lowStockItems = products
            .filter(p => p.stock <= p.minStockLevel)
            .sort((a, b) => a.stock - b.stock)
            .slice(0, 8);

        // Payment method distribution
        const paymentStats = {};
        allCompletedSales.forEach(s => {
            const m = s.paymentMethod || 'Other';
            paymentStats[m] = (paymentStats[m] || 0) + s.grandTotal;
        });

        // Top selling products
        const productSalesMap = {};
        allCompletedSales.forEach(s => {
            (s.items || []).forEach(item => {
                const key = item.name || 'Unknown';
                if (!productSalesMap[key]) productSalesMap[key] = { name: key, units: 0, revenue: 0 };
                productSalesMap[key].units += item.quantity;
                productSalesMap[key].revenue += item.total;
            });
        });

        const topProducts = Object.values(productSalesMap)
            .sort((a, b) => b.units - a.units)
            .slice(0, 5);

        return res.json({
            success: true,
            data: {
                metrics: {
                    totalProducts,
                    totalCustomers,
                    totalEmployees,
                    totalRevenue,
                    totalSalesCount,
                    todayRevenue,
                    todaySalesCount,
                    lowStockCount: lowStockItems.length
                },
                lowStockItems,
                recentTransactions: recentSales,
                paymentStats,
                topProducts
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get personalized stats for Employee Dashboard
// @route   GET /api/dashboard/employee
// @access  Private
const getEmployeeDashboard = async (req, res, next) => {
    try {
        const employeeId = req.user._id;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayDateStr = new Date().toISOString().slice(0, 10);

        const [
            myCompletedSales,
            myRecentSales,
            todayAttendance,
            availableProductsCount
        ] = await Promise.all([
            Sale.find({ soldBy: employeeId, saleStatus: 'Completed' }).select('grandTotal createdAt items').lean(),
            Sale.find({ soldBy: employeeId }).sort({ createdAt: -1 }).limit(5).lean(),
            Attendance.findOne({ employee: employeeId, date: todayDateStr }).lean(),
            Product.countDocuments({ status: 'active', stock: { $gt: 0 } })
        ]);

        const myLifetimeRevenue = myCompletedSales.reduce((acc, s) => acc + s.grandTotal, 0);
        const myLifetimeSalesCount = myCompletedSales.length;

        const myTodaySales = myCompletedSales.filter(s => new Date(s.createdAt) >= todayStart);
        const myTodayRevenue = myTodaySales.reduce((acc, s) => acc + s.grandTotal, 0);
        const myTodaySalesCount = myTodaySales.length;

        return res.json({
            success: true,
            data: {
                user: {
                    name: req.user.name,
                    role: req.user.role,
                    designation: req.user.designation,
                    email: req.user.email
                },
                metrics: {
                    todaySalesCount: myTodaySalesCount,
                    todayRevenue: myTodayRevenue,
                    lifetimeSalesCount: myLifetimeSalesCount,
                    lifetimeRevenue: myLifetimeRevenue,
                    availableProductsCount
                },
                attendance: todayAttendance,
                recentSales: myRecentSales
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAdminDashboard,
    getEmployeeDashboard
};
