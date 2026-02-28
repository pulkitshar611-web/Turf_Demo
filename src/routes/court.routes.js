const express = require('express');
const router = express.Router();
const {
    createCourt,
    getAllCourts,
    getCourtById,
    updateCourt,
    updateCourtStatus,
    deleteCourt,
} = require('../controllers/court.controller');
const { protect } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');

// All routes require authentication
router.use(protect);

// Publicly available to all logged-in users (STAFF & ADMIN)
router.get('/', allowRoles('ADMIN', 'STAFF'), getAllCourts);
router.get('/:id', allowRoles('ADMIN', 'STAFF'), getCourtById);

// Management actions restricted to ADMIN only
router.use(allowRoles('ADMIN'));
router.post('/', createCourt);
router.put('/:id', updateCourt);
router.patch('/:id/status', updateCourtStatus);
router.delete('/:id', deleteCourt);

module.exports = router;
