const express = require('express');
const router = express.Router();
const {
    createSale,
    getSales,
    getSaleById,
    cancelSale
} = require('../controllers/saleController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, getSales);
router.post('/', authenticate, createSale);
router.get('/:id', authenticate, getSaleById);
router.post('/:id/cancel', authenticate, requireAdmin, cancelSale);

module.exports = router;
