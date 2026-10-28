const express = require('express');
const router = express.Router();
const {
    getEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee
} = require('../controllers/employeeController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, requireAdmin, getEmployees);
router.get('/:id', authenticate, getEmployeeById);
router.post('/', authenticate, requireAdmin, createEmployee);
router.put('/:id', authenticate, requireAdmin, updateEmployee);
router.delete('/:id', authenticate, requireAdmin, deleteEmployee);

module.exports = router;
