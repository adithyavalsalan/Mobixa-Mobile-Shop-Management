const express = require('express');
const router = express.Router();
const {
    getCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deleteCustomer
} = require('../controllers/customerController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, getCustomers);
router.get('/:id', authenticate, getCustomerById);
router.get('/:id/history', authenticate, getCustomerById);
router.post('/', authenticate, createCustomer);
router.put('/:id', authenticate, updateCustomer);
router.delete('/:id', authenticate, requireAdmin, deleteCustomer);

module.exports = router;
