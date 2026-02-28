const express = require('express');
const router = express.Router();
const { createBooking, checkAvailability, getAllBookings, updateBookingStatus, deleteBooking, updateBooking } = require('../controllers/booking.controller');
const { protect } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');

// All routes are protected and restricted to ADMIN
router.use(protect);
router.use(allowRoles('ADMIN'));

router.post('/', createBooking);
router.get('/', getAllBookings);
router.post('/check-availability', checkAvailability);
router.patch('/:id/status', updateBookingStatus);
router.put('/:id', updateBooking);
router.delete('/:id', deleteBooking);

module.exports = router;
