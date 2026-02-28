const express = require('express');
const router = express.Router();
const {
    getPaymentsList,
    markAsPaid,
    updatePaymentMode,
    getPaymentById
} = require('../controllers/payment.controller');
const { protect } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');

// All routes are protected and restricted to STAFF and ADMIN
router.use(protect);
router.use(allowRoles('STAFF', 'ADMIN'));

/**
 * @route GET /api/payments
 * @desc Get all payments with optional filters
 */
router.get('/', getPaymentsList);

/**
 * @route GET /api/payments/:id
 * @desc Get detailed booking and payment info
 */
router.get('/:id', getPaymentById);

/**
 * @route PATCH /api/payments/:id/mark-paid
 * @desc Mark balance as paid
 */
router.patch('/:id/mark-paid', markAsPaid);

/**
 * @route PATCH /api/payments/:id/update-mode
 * @desc Update only the payment mode
 */
router.patch('/:id/update-mode', updatePaymentMode);

module.exports = router;
