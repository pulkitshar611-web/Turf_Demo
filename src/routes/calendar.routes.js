const express = require('express');
const router = express.Router();
const { getDayCalendar } = require('../controllers/calendar.controller');
const { protect } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');

// GET /api/calendar/day?date=YYYY-MM-DD
router.get(
    '/day',
    protect,
    allowRoles('ADMIN', 'STAFF'),
    getDayCalendar
);

module.exports = router;
