const express = require('express');
const router = express.Router();
const {
    checkIn,
    checkOut,
    getTodayStatus,
    getMyAttendance,
    getAllAttendance
} = require('../controllers/attendanceController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.post('/check-in', authenticate, checkIn);
router.post('/check-out', authenticate, checkOut);
router.get('/today', authenticate, getTodayStatus);
router.get('/my', authenticate, getMyAttendance);
router.get('/', authenticate, requireAdmin, getAllAttendance);

module.exports = router;
