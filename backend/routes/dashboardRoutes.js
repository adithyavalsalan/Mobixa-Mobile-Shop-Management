const express = require('express');
const router = express.Router();
const { getAdminDashboard, getEmployeeDashboard } = require('../controllers/dashboardController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/admin', authenticate, requireAdmin, getAdminDashboard);
router.get('/employee', authenticate, getEmployeeDashboard);

module.exports = router;
