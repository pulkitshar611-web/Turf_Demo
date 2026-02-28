const express = require('express');
const router = express.Router();
const {
    getBookingsList,
    getBookingDetails,
    createStaffBooking,
    updateBooking,
    cancelBooking,
    deleteBooking
} = require('../controllers/bookingList.controller');
const { protect } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');

// All staff booking routes are protected and restricted to STAFF/ADMIN
router.use(protect);
router.use(allowRoles('STAFF', 'ADMIN'));

router.get('/', getBookingsList);
router.get('/:id', getBookingDetails);
router.post('/', createStaffBooking);
router.put('/:id', updateBooking);
router.patch('/:id/cancel', cancelBooking);
router.delete('/:id', deleteBooking);

module.exports = router;
