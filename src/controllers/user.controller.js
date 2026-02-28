const User = require('../models/User.model');
const bcrypt = require('bcryptjs');

// @desc    Create new staff
// @route   POST /api/users/staff
// @access  Private (Admin only)
const createStaff = async (req, res) => {
    try {
        const { name, email, phone, password, status } = req.body;

        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create user with role STAFF and link to creating Admin
        const user = await User.create({
            name,
            email,
            phone,
            password, // Hashed by pre-save hook
            role: 'STAFF',
            status: status || 'ACTIVE',
            createdBy: req.user._id, // Link to the admin who created this staff
        });

        if (user) {
            res.status(201).json({
                success: true,
                message: 'Staff created successfully',
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                },
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
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

// @desc    Get all staff created by logged in admin
// @route   GET /api/users/staff
// @access  Private (Admin only)
const getAllStaff = async (req, res) => {
    try {
        // Find staff created by the current admin
        const users = await User.find({ role: 'STAFF', createdBy: req.user._id }).select('-password');
        res.status(200).json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get single staff details
// @route   GET /api/users/staff/:id
// @access  Private (Admin only)
const getStaffById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (user && user.role === 'STAFF') {
            // Check authorization: Admin can only view staff they created
            if (user.createdBy && user.createdBy.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Not authorized to view this staff member' });
            }
            res.status(200).json(user);
        } else {
            res.status(404).json({ message: 'Staff member not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update staff details
// @route   PUT /api/users/staff/:id
// @access  Private (Admin only)
const updateStaff = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (user && user.role === 'STAFF') {
            // Check authorization
            if (user.createdBy && user.createdBy.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Not authorized to update this staff member' });
            }

            user.name = req.body.name || user.name;
            user.phone = req.body.phone || user.phone;

            if (req.body.password) {
                user.password = req.body.password; // pre-save hook will hash it
            }

            const updatedUser = await user.save();

            res.status(200).json({
                success: true,
                message: 'Staff updated successfully',
                user: {
                    id: updatedUser._id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    role: updatedUser.role,
                    status: updatedUser.status,
                },
            });
        } else {
            res.status(404).json({ message: 'Staff member not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update staff status (Active/Inactive)
// @route   PATCH /api/users/staff/:id/status
// @access  Private (Admin only)
const updateStaffStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const user = await User.findById(req.params.id);

        if (user && user.role === 'STAFF') {
            // Check authorization
            if (user.createdBy && user.createdBy.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Not authorized to update this staff member' });
            }

            if (!['ACTIVE', 'INACTIVE'].includes(status)) {
                return res.status(400).json({ message: 'Invalid status' });
            }

            user.status = status;
            await user.save();

            res.status(200).json({
                success: true,
                message: `Staff status updated to ${status}`,
            });
        } else {
            res.status(404).json({ message: 'Staff member not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete staff
// @route   DELETE /api/users/staff/:id
// @access  Private (Admin only)
const deleteStaff = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (user && user.role === 'STAFF') {
            // Check authorization
            if (user.createdBy && user.createdBy.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Not authorized to delete this staff member' });
            }

            await user.deleteOne();
            res.status(200).json({ message: 'Staff member removed' });
        } else {
            res.status(404).json({ message: 'Staff member not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    createStaff,
    getAllStaff,
    getStaffById,
    updateStaff,
    updateStaffStatus,
    deleteStaff,
};
