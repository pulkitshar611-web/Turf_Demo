const moment = require('moment');

/**
 * Generates 15-minute slots between startTime and endTime
 * @param {string} startTime - "HH:mm" (e.g., "06:00")
 * @param {string} endTime - "HH:mm" (e.g., "07:00")
 * @returns {string[]} Array of slot start times (e.g., ["06:00", "06:15", "06:30", "06:45"])
 */
const generateSlots = (startTime, endTime) => {
    const slots = [];
    let current = moment(startTime, 'HH:mm');
    const end = moment(endTime, 'HH:mm');

    // Ensure we are working with today's date to avoid issues with overnight logic if any,
    // though for now we assume single day bookings.

    // Validate that end time is after start time
    if (!end.isAfter(current)) {
        throw new Error('End time must be after start time');
    }

    while (current.isBefore(end)) {
        slots.push(current.format('HH:mm'));
        current.add(15, 'minutes');
    }

    return slots;
};

module.exports = { generateSlots };
