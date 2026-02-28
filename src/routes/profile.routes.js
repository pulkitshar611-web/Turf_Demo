const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, changePassword } = require('../controllers/profile.controller');
const { protect } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');
const upload = require('../middlewares/upload.middleware');

// All profile routes are restricted to logged-in users (ADMIN or STAFF/MANAGEMENT)
router.use(protect);
router.use(allowRoles('ADMIN', 'STAFF'));

router.get('/', getProfile);
router.put('/', upload.single('avatar'), updateProfile);
router.put('/change-password', changePassword);

module.exports = router;
