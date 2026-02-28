const User = require('../models/User.model');
const cloudinary = require('cloudinary').v2;

/**
 * GET /api/admin/profile
 * Get current admin profile
 */
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * PUT /api/admin/profile
 * Update personal info and avatar
 */
const updateProfile = async (req, res) => {
    try {
        const { name, email } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Email uniqueness check if email is changing
        if (email && email !== user.email) {
            const emailExists = await User.findOne({ email });
            if (emailExists) {
                return res.status(400).json({ message: 'Email already in use' });
            }
            user.email = email;
        }

        if (name) user.name = name;

        // Handle avatar upload via Cloudinary (multer-storage-cloudinary handled the upload)
        if (req.file) {
            // Delete old avatar from cloudinary if it exists
            if (user.avatar && user.avatar.includes('cloudinary')) {
                try {
                    // Extract public_id from url
                    const parts = user.avatar.split('/');
                    const filename = parts[parts.length - 1];
                    const publicId = `turf_avatars/${filename.split('.')[0]}`;
                    await cloudinary.uploader.destroy(publicId);
                } catch (err) {
                    console.error('Error deleting old avatar:', err);
                }
            }
            user.avatar = req.file.path; // Cloudinary URL
        }

        await user.save();
        res.status(200).json(user);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * PUT /api/admin/profile/change-password
 * Secure password change
 */
const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body;

        if (!oldPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ message: 'Please provide all password fields' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'New passwords do not match' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters' });
        }

        const user = await User.findById(req.user.id).select('+password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check old password
        const isMatch = await user.matchPassword(oldPassword);
        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect old password' });
        }

        // Set new password (the pre-save hook will hash it)
        user.password = newPassword;
        await user.save();

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    changePassword
};
