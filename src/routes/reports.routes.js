const express = require('express');
const router = express.Router();
const {
    getDailyReport,
    getMonthlyReport,
    getRevenueReport,
    getPendingBalanceReport,
    getRecurringBookingReport
} = require('../controllers/reports.controller');
const { protect } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');

// All report routes are restricted to ADMIN only
router.use(protect);
router.use(allowRoles('ADMIN'));

router.get('/daily', getDailyReport);
router.get('/monthly', getMonthlyReport);
router.get('/revenue', getRevenueReport);
router.get('/pending', getPendingBalanceReport);
router.get('/recurring', getRecurringBookingReport);

module.exports = router;
