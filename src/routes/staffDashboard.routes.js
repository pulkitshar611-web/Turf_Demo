const express = require('express');
const router = express.Router();
const {
    getStaffDashboardSummary,
    getBookingsPerDay,
    getPaymentStatusDistribution,
    getCourtUtilization
} = require('../controllers/staffDashboard.controller');
const { protect } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');

// All routes are protected and restricted to STAFF and ADMIN
router.use(protect);
router.use(allowRoles('STAFF', 'ADMIN'));

router.get('/summary', getStaffDashboardSummary);
router.get('/bookings-per-day', getBookingsPerDay);
router.get('/payment-status', getPaymentStatusDistribution);
router.get('/court-utilization', getCourtUtilization);

module.exports = router;
