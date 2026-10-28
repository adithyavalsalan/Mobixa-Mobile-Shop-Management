const express = require('express');
const router = express.Router();
const { generateReport, exportCSV } = require('../controllers/reportController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/generate', authenticate, requireAdmin, generateReport);
router.get('/export-csv', authenticate, requireAdmin, exportCSV);

module.exports = router;
