const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settings.controller');
const { protect } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');

// All settings routes are restricted to ADMIN only
router.use(protect);
router.use(allowRoles('ADMIN'));

router.get('/', getSettings);
router.put('/', updateSettings);

module.exports = router;
