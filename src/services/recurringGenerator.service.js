const RecurringBooking = require('../models/RecurringBooking.model');
const { createSingleBooking } = require('./bookingCore.service');
const mongoose = require('mongoose');
const { normalizeToMidnight } = require('../utils/dateUtils');

// Helper: Get Day Index (MON = 1, SUN = 0 or 7 depending on lib, let's standardize)
const DAYS_MAP = {
    'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6
};

/**
 * Generate dates based on recurrence rule
 * @param {Object} rule - RecurringBooking document
 * @returns {Array<Date>} - List of dates to book
 */
const generateDates = (rule) => {
    const dates = [];
    // Start from rule start date or NOW, whichever is later (for future generation)
    // But for initial creation, we might want to respect startDate even if today.
    // Let's assume startDate is standard.

    let currentDate = normalizeToMidnight(rule.startDate);
    let endDate = rule.endDate ? normalizeToMidnight(rule.endDate) : new Date(currentDate);

    // If no end date, generate for next 3 months by default (as a reasonable limit)
    if (!rule.endDate) {
        endDate.setMonth(endDate.getMonth() + 3);
    }

    // Ensure times are at midnight (redundant but safe)
    currentDate = normalizeToMidnight(currentDate);
    endDate = normalizeToMidnight(endDate);

    const targetDayIndexes = rule.daysOfWeek?.map(d => DAYS_MAP[d]);

    while (currentDate <= endDate) {
        if (rule.recurrenceType === 'WEEKLY') {
            if (targetDayIndexes.includes(currentDate.getDay())) {
                dates.push(normalizeToMidnight(currentDate));
            }
        } else if (rule.recurrenceType === 'MONTHLY') {
            if (currentDate.getDate() === rule.fixedDate) {
                dates.push(normalizeToMidnight(currentDate));
            }
        }

        // Advance one day
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
};

/**
 * Process a recurring rule and generate bookings
 * @param {String} ruleId 
 * @param {Object} session (optional)
 * @returns {Object} result stats
 */
const processRecurringBooking = async (ruleId, externalSession = null) => {
    const localSession = externalSession ? null : await mongoose.startSession();
    if (localSession) localSession.startTransaction();
    const session = externalSession || localSession;

    try {
        const rule = await RecurringBooking.findById(ruleId).session(session);
        if (!rule || rule.status !== 'ACTIVE') {
            throw new Error('Rule not found or inactive');
        }

        const datesToBook = generateDates(rule);
        const results = {
            success: 0,
            failed: 0,
            conflicts: []
        };

        for (const date of datesToBook) {
            try {
                await createSingleBooking({
                    customerName: rule.customerName,
                    customerPhone: rule.customerPhone,
                    sportType: rule.sportType,
                    courtId: rule.courtId,
                    bookingDate: date,
                    startTime: rule.startTime,
                    endTime: rule.endTime,
                    // Use values from the recurring rule
                    advancePaid: 0, // Advance is attached to the Subscription, not individual booking
                    paymentStatus: rule.paymentStatus === 'PAID' ? 'PAID' : 'PENDING',
                    paymentMode: 'CASH', // Default, maybe add to rule too later if needed
                    discountType: rule.discountType || 'NONE',
                    discountValue: rule.discountValue || 0,
                    createdBy: rule.createdBy,
                    source: 'RECURRING',
                    recurringId: rule._id
                }, session);

                results.success++;
            } catch (error) {
                results.failed++;
                results.conflicts.push({
                    date: date.toISOString().split('T')[0],
                    reason: error.message
                });
                // We Continue processing other dates even if one fails
            }
        }

        if (localSession) {
            await localSession.commitTransaction();
            localSession.endSession();
        }

        return results;

    } catch (error) {
        if (localSession) {
            await localSession.abortTransaction();
            localSession.endSession();
        }
        throw error;
    }
};

module.exports = {
    generateDates,
    processRecurringBooking
};
