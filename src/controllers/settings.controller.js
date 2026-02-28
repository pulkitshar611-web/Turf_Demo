const Settings = require('../models/Settings.model');

/**
 * GET /api/admin/settings
 * Fetch centralized system configuration
 */
const getSettings = async (req, res) => {
    try {
        const settings = await Settings.getSettings();
        res.status(200).json(settings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * PUT /api/admin/settings
 * Update system configuration
 * Admin only
 */
const updateSettings = async (req, res) => {
    try {
        const { turfName, openingTime, closingTime, weekendDays, currency } = req.body;

        // Validation: openingTime < closingTime
        if (openingTime && closingTime) {
            const [openH, openM] = openingTime.split(':').map(Number);
            const [closeH, closeM] = closingTime.split(':').map(Number);

            const openVal = openH * 60 + openM;
            const closeVal = closeH * 60 + closeM;

            if (openVal >= closeVal) {
                return res.status(400).json({
                    message: 'Opening time must be earlier than closing time'
                });
            }
        }

        // Weekend validation
        if (weekendDays && (!Array.isArray(weekendDays) || weekendDays.length === 0)) {
            return res.status(400).json({
                message: 'At least one weekend day is required'
            });
        }

        const settings = await Settings.findOne();
        if (!settings) {
            // Should not happen due to getSettings logic, but for safety:
            const newSettings = await Settings.create({
                turfName, openingTime, closingTime, weekendDays, currency
            });
            return res.status(200).json(newSettings);
        }

        settings.turfName = turfName || settings.turfName;
        settings.openingTime = openingTime || settings.openingTime;
        settings.closingTime = closingTime || settings.closingTime;
        settings.weekendDays = weekendDays || settings.weekendDays;
        settings.currency = currency || settings.currency;

        await settings.save();
        res.status(200).json(settings);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    getSettings,
    updateSettings
};
