const express = require('express');
const router = express.Router();
const {
    getDashboardSummary,
    getMonthlyRevenueTrend,
    getPaymentStatusBreakdown,
    getWeeklyEarnings
} = require('../controllers/dashboard.controller');
const { protect } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');

// All dashboard routes are protected and restricted to ADMIN
router.use(protect);
router.use(allowRoles('ADMIN'));

router.get('/summary', getDashboardSummary);
router.get('/monthly-revenue', getMonthlyRevenueTrend);
router.get('/payment-status', getPaymentStatusBreakdown);
router.get('/weekly-earnings', getWeeklyEarnings);

module.exports = router;
