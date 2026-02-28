const Court = require('../models/Court.model');

// @desc    Create new court
// @route   POST /api/courts
// @access  Private (Admin only)
const createCourt = async (req, res) => {
    try {
        const { name, sportType, weekdayPrice, weekendPrice, status } = req.body;

        const courtExists = await Court.findOne({ name, sportType });

        if (courtExists) {
            return res.status(400).json({ message: 'Court with this name already exists for this sport' });
        }

        const court = await Court.create({
            name,
            sportType,
            weekdayPrice,
            weekendPrice,
            status: status || 'ACTIVE',
        });

        res.status(201).json({
            success: true,
            message: 'Court created successfully',
            court,
        });
    } catch (error) {
        console.error(error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get all courts
// @route   GET /api/courts
// @access  Private (Admin only)
const getAllCourts = async (req, res) => {
    try {
        const courts = await Court.find().sort({ createdAt: -1 });
        res.status(200).json(courts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get single court
// @route   GET /api/courts/:id
// @access  Private (Admin only)
const getCourtById = async (req, res) => {
    try {
        const court = await Court.findById(req.params.id);

        if (court) {
            res.status(200).json(court);
        } else {
            res.status(404).json({ message: 'Court not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update court
// @route   PUT /api/courts/:id
// @access  Private (Admin only)
const updateCourt = async (req, res) => {
    try {
        const court = await Court.findById(req.params.id);

        if (court) {
            court.name = req.body.name || court.name;
            court.weekdayPrice = req.body.weekdayPrice !== undefined ? req.body.weekdayPrice : court.weekdayPrice;
            court.weekendPrice = req.body.weekendPrice !== undefined ? req.body.weekendPrice : court.weekendPrice;

            // Allow status update here as well or keep specific route, logic: keep flexible
            if (req.body.status) {
                court.status = req.body.status;
            }

            // Optional: Prevent sportType update if needed, currently not restricted but usually static

            const updatedCourt = await court.save();
            res.status(200).json({
                success: true,
                message: 'Court updated successfully',
                court: updatedCourt,
            });
        } else {
            res.status(404).json({ message: 'Court not found' });
        }
    } catch (error) {
        console.error(error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update court status
// @route   PATCH /api/courts/:id/status
// @access  Private (Admin only)
const updateCourtStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const court = await Court.findById(req.params.id);

        if (court) {
            if (!['ACTIVE', 'INACTIVE'].includes(status)) {
                return res.status(400).json({ message: 'Invalid status' });
            }

            court.status = status;
            await court.save();

            res.status(200).json({
                success: true,
                message: `Court status updated to ${status}`,
                court,
            });
        } else {
            res.status(404).json({ message: 'Court not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete court
// @route   DELETE /api/courts/:id
// @access  Private (Admin only)
const deleteCourt = async (req, res) => {
    try {
        const court = await Court.findById(req.params.id);

        if (court) {
            await court.deleteOne();
            res.status(200).json({ message: 'Court removed' });
        } else {
            res.status(404).json({ message: 'Court not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    createCourt,
    getAllCourts,
    getCourtById,
    updateCourt,
    updateCourtStatus,
    deleteCourt,
};
