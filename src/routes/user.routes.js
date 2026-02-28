const express = require('express');
const router = express.Router();
const {
    createStaff,
    getAllStaff,
    getStaffById,
    updateStaff,
    updateStaffStatus,
    deleteStaff,
} = require('../controllers/user.controller');
const { protect } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');

// All routes are protected and restricted to ADMIN logic inside controllers handles data isolation
// The allowRoles('ADMIN') middleware ensures only admins can hit these endpoints at all
router.use(protect);
router.use(allowRoles('ADMIN'));

router.post('/staff', createStaff);
router.get('/staff', getAllStaff);
router.get('/staff/:id', getStaffById);
router.put('/staff/:id', updateStaff);
router.patch('/staff/:id/status', updateStaffStatus);
router.delete('/staff/:id', deleteStaff);

module.exports = router;
