const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', getSettings);
router.put('/', authenticate, requireAdmin, updateSettings);

module.exports = router;
