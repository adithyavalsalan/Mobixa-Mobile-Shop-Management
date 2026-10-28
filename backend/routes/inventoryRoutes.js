const express = require('express');
const router = express.Router();
const {
    getInventory,
    stockIn,
    adjustStock,
    getMovements
} = require('../controllers/inventoryController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, getInventory);
router.post('/stock-in', authenticate, stockIn);
router.post('/adjust', authenticate, requireAdmin, adjustStock);
router.get('/movements', authenticate, getMovements);

module.exports = router;
