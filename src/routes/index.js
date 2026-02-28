const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const courtRoutes = require('./court.routes');
const bookingRoutes = require('./booking.routes');
const calendarRoutes = require('./calendar.routes');
const recurringBookingRoutes = require('./recurringBooking.routes');
const dashboardRoutes = require('./dashboard.routes');
const paymentRoutes = require('./payment.routes');
const reportsRoutes = require('./reports.routes');
const settingsRoutes = require('./settings.routes');
const profileRoutes = require('./profile.routes');
const bookingListRoutes = require('./bookingList.routes');
const staffCalendarRoutes = require('./staffCalendar.routes');
const staffDashboardRoutes = require('./staffDashboard.routes');

router.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/courts', courtRoutes);
router.use('/calendar', calendarRoutes);

// Admin Routes
router.use('/admin/bookings', bookingRoutes);
router.use('/admin/dashboard', dashboardRoutes);
router.use('/admin/payments', paymentRoutes);
router.use('/admin/reports', reportsRoutes);
router.use('/admin/settings', settingsRoutes);
router.use('/admin/profile', profileRoutes);

// Staff/Management Routes
router.use('/staff/bookings', bookingListRoutes);
router.use('/staff/calendar', staffCalendarRoutes);
router.use('/staff/profile', profileRoutes);
router.use('/staff/dashboard', staffDashboardRoutes);
router.use('/management/profile', profileRoutes);
router.use('/management/dashboard', staffDashboardRoutes);

// Shared/Other
router.use('/recurring-bookings', recurringBookingRoutes);

module.exports = router;
