const User = require('../models/User');
const Sale = require('../models/Sale');
const Attendance = require('../models/Attendance');

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private (Admin)
const getEmployees = async (req, res, next) => {
    try {
        const { search, role, status } = req.query;
        const query = {};

        if (role && role !== 'all') {
            query.role = role.toLowerCase();
        }

        if (status && status !== 'all') {
            query.status = status.toLowerCase();
        }

        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            query.$or = [
                { name: regex },
                { email: regex },
                { phone: regex },
                { designation: regex }
            ];
        }

        const employees = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .lean();

        const totalEmployees = await User.countDocuments();
        const activeCount = await User.countDocuments({ status: 'active' });
        const adminCount = await User.countDocuments({ role: 'admin' });

        return res.json({
            success: true,
            count: employees.length,
            summary: {
                totalEmployees,
                activeCount,
                adminCount
            },
            data: employees
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get employee details & performance
// @route   GET /api/employees/:id
// @access  Private
const getEmployeeById = async (req, res, next) => {
    try {
        const employee = await User.findById(req.params.id).select('-password');
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        // Restrict employee from viewing other employee's confidential salary unless admin
        if (req.user.role !== 'admin' && String(req.user._id) !== String(employee._id)) {
            return res.status(403).json({ success: false, message: 'Unauthorized to view other employee details.' });
        }

        const sales = await Sale.find({ soldBy: employee._id, saleStatus: 'Completed' })
            .sort({ createdAt: -1 })
            .limit(20);

        const totalSalesAmount = sales.reduce((sum, s) => sum + s.grandTotal, 0);

        const recentAttendance = await Attendance.find({ employee: employee._id })
            .sort({ date: -1 })
            .limit(10);

        return res.json({
            success: true,
            data: {
                employee,
                stats: {
                    totalSalesCount: sales.length,
                    totalSalesAmount
                },
                recentSales: sales,
                recentAttendance
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new employee user account
// @route   POST /api/employees
// @access  Private (Admin)
const createEmployee = async (req, res, next) => {
    try {
        const { name, email, phone, password, role = 'employee', designation, salary, status = 'active' } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and password are required.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters.'
            });
        }

        const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
        if (existingEmail) {
            return res.status(400).json({
                success: false,
                message: `An account with email '${email}' already exists.`
            });
        }

        const username = email.trim().split('@')[0].toLowerCase();

        const employee = await User.create({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            username,
            phone: phone ? phone.trim() : '',
            password,
            role: role.toLowerCase() === 'admin' ? 'admin' : 'employee',
            designation: designation ? designation.trim() : 'Sales Executive',
            salary: Number(salary) || 0,
            status: status === 'inactive' ? 'inactive' : 'active'
        });

        return res.status(201).json({
            success: true,
            message: 'Employee account created successfully.',
            data: {
                id: employee._id,
                name: employee.name,
                email: employee.email,
                role: employee.role,
                phone: employee.phone,
                designation: employee.designation,
                status: employee.status
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update employee account
// @route   PUT /api/employees/:id
// @access  Private (Admin)
const updateEmployee = async (req, res, next) => {
    try {
        const employee = await User.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        const { name, email, phone, designation, salary, status, role, password } = req.body;

        // Prevent deactivating or demoting the last active administrator
        if (employee.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin', status: 'active' });
            if (adminCount <= 1) {
                if (status === 'inactive') {
                    return res.status(400).json({
                        success: false,
                        message: 'Cannot deactivate the only active administrator in the system.'
                    });
                }
                if (role && role !== 'admin') {
                    return res.status(400).json({
                        success: false,
                        message: 'Cannot demote the only administrator in the system.'
                    });
                }
            }
        }

        if (email && email.trim().toLowerCase() !== employee.email) {
            const existing = await User.findOne({
                email: email.trim().toLowerCase(),
                _id: { $ne: employee._id }
            });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: `Email '${email}' is already taken.`
                });
            }
            employee.email = email.trim().toLowerCase();
        }

        if (name) employee.name = name.trim();
        if (phone !== undefined) employee.phone = phone.trim();
        if (designation !== undefined) employee.designation = designation.trim();
        if (salary !== undefined) employee.salary = Number(salary);
        if (status) employee.status = status;
        if (role) employee.role = role.toLowerCase() === 'admin' ? 'admin' : 'employee';

        if (password && password.trim().length >= 6) {
            employee.password = password.trim();
        }

        await employee.save();

        return res.json({
            success: true,
            message: 'Employee updated successfully.',
            data: employee
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete employee account
// @route   DELETE /api/employees/:id
// @access  Private (Admin)
const deleteEmployee = async (req, res, next) => {
    try {
        const employee = await User.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        // Prevent deleting oneself
        if (String(req.user._id) === String(employee._id)) {
            return res.status(400).json({
                success: false,
                message: 'You cannot delete your own logged-in account.'
            });
        }

        // Prevent removing last admin
        if (employee.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin', status: 'active' });
            if (adminCount <= 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete the only administrator.'
                });
            }
        }

        await User.findByIdAndDelete(employee._id);
        return res.json({
            success: true,
            message: 'Employee account deleted successfully.'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee
};
