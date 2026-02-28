const BookingSlot = require('../models/BookingSlot.model');
const { generateSlots } = require('./slotGenerator.service');
const { normalizeToMidnight } = require('../utils/dateUtils');

/**
 * Checks if the requested slots are available for a given court and date.
 * Excludes a specific booking ID if provided (useful for updates).
 * 
 * @param {string} courtId - The ID of the court
 * @param {Date|string} bookingDate - The date of the booking
 * @param {string} startTime - "HH:mm" format
 * @param {string} endTime - "HH:mm" format
 * @param {Object} [session] - Mongoose session for atomic operations
 * @param {string} [excludeBookingId] - (Optional) ID to exclude from conflict check
 * @returns {Promise<Object>} - { available: boolean, conflicts: Array }
 */
const checkSlotAvailability = async (courtId, bookingDate, startTime, endTime, session = null, excludeBookingId = null) => {
    const slots = generateSlots(startTime, endTime);
    const normalizedDate = normalizeToMidnight(bookingDate);

    const query = {
        courtId,
        bookingDate: normalizedDate,
        slotTime: { $in: slots },
        status: 'BOOKED' // Only check against slots that are currently BOOKED
    };

    if (excludeBookingId) {
        query.bookingId = { $ne: excludeBookingId };
    }

    const conflicts = await BookingSlot.find(query).session(session).lean();

    if (conflicts.length > 0) {
        const uniqueConflictingTimes = [...new Set(conflicts.map(c => c.slotTime))].sort();
        return {
            available: false,
            conflicts: uniqueConflictingTimes
        };
    }

    return {
        available: true,
        conflicts: []
    };
};

/**
 * Standard conflict error message
 */
const throwConflictError = (conflictingSlots = []) => {
    const message = conflictingSlots.length > 0
        ? `This slot is already booked. Please select another time. (Conflicts: ${conflictingSlots.join(', ')})`
        : "This slot is already booked. Please select another time.";

    const error = new Error(message);
    error.status = 409;
    throw error;
};

module.exports = {
    checkSlotAvailability,
    throwConflictError
};
