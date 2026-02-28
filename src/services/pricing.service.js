const moment = require('moment');

/**
 * Calculates the total base price for the booking
 * @param {Object} court - The court object containing pricing details
 * @param {number} totalSlots - Total number of 15-minute slots
 * @param {Date} bookingDate - The date of the booking
 * @returns {number} The calculated base amount
 */
const calculatePrice = (court, totalSlots, bookingDate) => {
    const date = moment(bookingDate);
    const dayOfWeek = date.day(); // 0 = Sunday, 6 = Saturday

    let hourlyRate = 0;

    // Check if it's Saturday (6) or Sunday (0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        hourlyRate = court.weekendPrice;
    } else {
        hourlyRate = court.weekdayPrice;
    }

    // Calculate price for 15 minutes (hourlyRate / 4)
    const slotPrice = hourlyRate / 4;

    return slotPrice * totalSlots;
};

module.exports = { calculatePrice };
