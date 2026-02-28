const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');
const {
    createRecurringBooking,
    getRecurringBookings,
    updateRecurringBooking,
    toggleRecurringStatus,
    deleteRecurringBooking
} = require('../controllers/recurringBooking.controller');

// Apply protection to all routes
router.use(protect);
router.use(allowRoles('ADMIN', 'STAFF'));

router.post('/', createRecurringBooking);
router.get('/', getRecurringBookings);
router.put('/:id', updateRecurringBooking);
router.patch('/:id/status', toggleRecurringStatus);
router.delete('/:id', deleteRecurringBooking);

module.exports = router;
