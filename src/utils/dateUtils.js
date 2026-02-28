const moment = require('moment');

/**
 * Normalizes a date to 00:00:00.000 (Midnight) in local time.
 * This is critical for consistent calendar and slot management.
 * 
 * @param {Date|string} date - Date to normalize
 * @returns {Date} - Normalized date object
 */
const normalizeToMidnight = (date) => {
    if (!date) return null;
    return moment(date).startOf('day').toDate();
};

module.exports = {
    normalizeToMidnight
};
