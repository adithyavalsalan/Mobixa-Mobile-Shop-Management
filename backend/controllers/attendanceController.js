const Attendance = require('../models/Attendance');

const getTodayDateString = () => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
};

// @desc    Check-in for today
// @route   POST /api/attendance/check-in
// @access  Private
const checkIn = async (req, res, next) => {
    try {
        const today = getTodayDateString();
        const existing = await Attendance.findOne({
            employee: req.user._id,
            date: today
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: `You have already checked in today at ${new Date(existing.checkIn).toLocaleTimeString()}`
            });
        }

        const now = new Date();
        const record = await Attendance.create({
            employee: req.user._id,
            date: today,
            checkIn: now,
            status: 'Present'
        });

        return res.status(201).json({
            success: true,
            message: 'Checked in successfully.',
            data: record
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Check-out for today
// @route   POST /api/attendance/check-out
// @access  Private
const checkOut = async (req, res, next) => {
    try {
        const today = getTodayDateString();
        const record = await Attendance.findOne({
            employee: req.user._id,
            date: today
        });

        if (!record) {
            return res.status(400).json({
                success: false,
                message: 'No active check-in record found for today.'
            });
        }

        if (record.checkOut) {
            return res.status(400).json({
                success: false,
                message: `You have already checked out today at ${new Date(record.checkOut).toLocaleTimeString()}`
            });
        }

        record.checkOut = new Date();
        await record.save();

        return res.json({
            success: true,
            message: 'Checked out successfully.',
            data: record
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get attendance status for current user today
// @route   GET /api/attendance/today
// @access  Private
const getTodayStatus = async (req, res, next) => {
    try {
        const today = getTodayDateString();
        const record = await Attendance.findOne({
            employee: req.user._id,
            date: today
        });

        return res.json({
            success: true,
            data: record || null
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get attendance history for current employee
// @route   GET /api/attendance/my
// @access  Private
const getMyAttendance = async (req, res, next) => {
    try {
        const { limit = 30 } = req.query;
        const records = await Attendance.find({ employee: req.user._id })
            .sort({ date: -1 })
            .limit(Number(limit));

        return res.json({
            success: true,
            data: records
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all attendance (Admin view)
// @route   GET /api/attendance
// @access  Private (Admin)
const getAllAttendance = async (req, res, next) => {
    try {
        const { date, employeeId, startDate, endDate, limit = 100 } = req.query;
        const query = {};

        if (date) query.date = date;
        if (employeeId) query.employee = employeeId;
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = startDate;
            if (endDate) query.date.$lte = endDate;
        }

        const records = await Attendance.find(query)
            .sort({ date: -1, createdAt: -1 })
            .limit(Number(limit))
            .populate('employee', 'name email role designation');

        return res.json({
            success: true,
            count: records.length,
            data: records
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    checkIn,
    checkOut,
    getTodayStatus,
    getMyAttendance,
    getAllAttendance
};
