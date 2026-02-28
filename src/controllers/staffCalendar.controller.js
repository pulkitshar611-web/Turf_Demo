const mongoose = require('mongoose');
const moment = require('moment');
const Booking = require('../models/Booking.model');
const BookingSlot = require('../models/BookingSlot.model');
const Court = require('../models/Court.model');
const Payment = require('../models/Payment.model');
const Settings = require('../models/Settings.model');
const { generateSlots } = require('../services/slotGenerator.service');
const { calculatePrice } = require('../services/pricing.service');
const { generateDates } = require('../services/recurringGenerator.service');
const { checkSlotAvailability, throwConflictError } = require('../services/slotValidation.service');
const { normalizeToMidnight } = require('../utils/dateUtils');

/**
 * @desc    Get Day Calendar (Staff View)
 * @route   GET /api/staff/calendar/day
 */
const getStaffDayCalendar = async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ success: false, message: 'Date is required' });
        }

        const queryDate = normalizeToMidnight(date);
        const endOfDay = moment(queryDate).endOf('day').toDate();

        // 1. Fetch all ACTIVE courts
        const courts = await Court.find({ status: 'ACTIVE' }).sort({ createdAt: 1 });

        // 2. Fetch all bookings for the selected date (not cancelled)
        const bookings = await Booking.find({
            bookingDate: { $gte: queryDate, $lte: endOfDay },
            status: { $ne: 'CANCELLED' }
        }).populate('courtId', 'name');

        // 3. Fetch all payments for these bookings to determine status
        const bookingIds = bookings.map(b => b._id);
        const payments = await Payment.find({ bookingId: { $in: bookingIds } });

        // 4. Group bookings by court
        const formattedCourts = await Promise.all(courts.map(async (court) => {
            const courtBookings = bookings.filter(b => b.courtId && b.courtId._id.toString() === court._id.toString());

            const slots = courtBookings.map(b => {
                const payment = payments.find(p => p.bookingId.toString() === b._id.toString());

                // Payment Status Mapping
                let ps = 'ADVANCE_PENDING';
                if (payment) {
                    if (payment.balanceAmount === 0) {
                        ps = 'PAID';
                    } else if (payment.advancePaid > 0) {
                        ps = 'BALANCE_PENDING';
                    }
                }

                const source = b.bookingSource || 'MANUAL';

                return {
                    bookingId: b._id.toString(),
                    customerName: b.customerName,
                    customerPhone: b.customerPhone,
                    timeSlot: `${b.startTime} - ${b.endTime}`,
                    startTime: b.startTime,
                    endTime: b.endTime,
                    finalAmount: b.finalAmount,
                    advancePaid: payment ? payment.advancePaid : 0,
                    balanceAmount: payment ? payment.balanceAmount : b.finalAmount,
                    paymentStatus: ps,
                    bookingSource: source,
                    isEditable: source === 'MANUAL',
                    isDeletable: source === 'MANUAL'
                };
            });

            return {
                courtId: court._id,
                courtName: `${court.sportType} - ${court.name}`,
                slots: slots
            };
        }));

        res.status(200).json({
            success: true,
            date: moment(date).format('YYYY-MM-DD'),
            courts: formattedCourts
        });

    } catch (error) {
        console.error('Staff Calendar Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update Booking from Calendar (Staff)
 * @route   PUT /api/staff/calendar/bookings/:id
 */
const updateStaffCalendarBooking = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const { customerName, customerPhone, startTime, endTime, advancePaid } = req.body;

        const booking = await Booking.findById(id).session(session);
        if (!booking) throw new Error('Booking not found');
        if (booking.status === 'CANCELLED') throw new Error('Cannot edit a cancelled booking');
        if (booking.bookingSource === 'RECURRING') throw new Error('Cannot edit a recurring booking');

        // Update allowed fields
        if (customerName) booking.customerName = customerName;
        if (customerPhone) booking.customerPhone = customerPhone;

        // Time change logic
        if (startTime && endTime && (startTime !== booking.startTime || endTime !== booking.endTime)) {
            const slots = generateSlots(startTime, endTime);

            // Check conflicts
            const availability = await checkSlotAvailability(
                booking.courtId,
                normalizeToMidnight(booking.bookingDate),
                startTime,
                endTime,
                session,
                booking._id
            );
            if (!availability.available) {
                throwConflictError(availability.conflicts);
            }

            // Update slots
            await BookingSlot.deleteMany({ bookingId: booking._id }).session(session);
            await BookingSlot.insertMany(slots.map(s => ({
                bookingId: booking._id,
                courtId: booking.courtId,
                bookingDate: normalizeToMidnight(booking.bookingDate),
                slotTime: s,
                status: 'BOOKED'
            })), { session });

            booking.startTime = startTime;
            booking.endTime = endTime;
            booking.totalSlots = slots.length;

            // Recalculate price
            const court = await Court.findById(booking.courtId).session(session);
            const newPrice = calculatePrice(court, slots.length, booking.bookingDate);
            booking.baseAmount = newPrice;
            booking.finalAmount = newPrice;
        }

        await booking.save({ session });

        // Update Payment
        const payment = await Payment.findOne({ bookingId: booking._id }).session(session);
        if (payment) {
            payment.totalAmount = booking.finalAmount;
            if (advancePaid !== undefined) payment.advancePaid = advancePaid;
            payment.balanceAmount = Math.max(0, payment.totalAmount - payment.advancePaid);
            payment.status = payment.balanceAmount === 0 ? 'PAID' : (payment.advancePaid > 0 ? 'PARTIAL' : 'PENDING');
            await payment.save({ session });
        }

        await session.commitTransaction();
        res.status(200).json({ success: true, message: 'Booking updated successfully' });

    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};

/**
 * @desc    Cancel Booking from Calendar (Staff)
 * @route   PATCH /api/staff/calendar/bookings/:id/cancel
 */
const cancelStaffCalendarBooking = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const booking = await Booking.findById(id).session(session);

        if (!booking) throw new Error('Booking not found');
        if (booking.status === 'CANCELLED') throw new Error('Booking already cancelled');
        if (booking.bookingSource === 'RECURRING') throw new Error('Cannot cancel a recurring booking');

        booking.status = 'CANCELLED';
        await booking.save({ session });

        // Update slots status instead of deleting
        await BookingSlot.updateMany(
            { bookingId: booking._id },
            { status: 'CANCELLED' },
            { session }
        );

        // Audit update for payment
        const payment = await Payment.findOne({ bookingId: booking._id }).session(session);
        if (payment) {
            payment.paymentNotes = (payment.paymentNotes || '') + ' [Staff Cancelled via Calendar]';
            await payment.save({ session });
        }

        await session.commitTransaction();
        res.status(200).json({ success: true, message: 'Booking cancelled successfully' });

    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};

const checkAvailability = async (req, res) => {
    try {
        const { courtId, startDate, endDate, startTime, endTime, daysOfWeek, recurrenceType } = req.body;

        // Mock a rule for generateDates
        const ruleMock = {
            startDate: normalizeToMidnight(startDate),
            endDate: normalizeToMidnight(endDate),
            recurrenceType: recurrenceType || 'WEEKLY',
            daysOfWeek: daysOfWeek || [],
            fixedDate: req.body.fixedDate
        };

        const dates = generateDates(ruleMock);
        const conflicts = [];

        for (const date of dates) {
            const availability = await checkSlotAvailability(courtId, date, startTime, endTime);
            if (!availability.available) {
                conflicts.push({
                    date: date.toISOString().split('T')[0],
                    reason: availability.message
                });
            }
        }

        res.status(200).json({
            success: true,
            available: conflicts.length === 0,
            conflicts,
            checkedDates: dates.length
        });

    } catch (error) {
        console.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete Booking from Calendar (Staff - Full Deletion)
 * @route   DELETE /api/staff/calendar/bookings/:id
 */
const deleteStaffCalendarBooking = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const booking = await Booking.findById(id).session(session);

        if (!booking) throw new Error('Booking not found');

        // 1. Delete Slots
        await BookingSlot.deleteMany({ bookingId: booking._id }).session(session);

        // 2. Delete Payment
        await Payment.deleteMany({ bookingId: booking._id }).session(session);

        // 3. Delete Booking
        await Booking.deleteOne({ _id: booking._id }).session(session);

        await session.commitTransaction();
        res.status(200).json({ success: true, message: 'Booking deleted permanently' });

    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};

module.exports = {
    getStaffDayCalendar,
    updateStaffCalendarBooking,
    cancelStaffCalendarBooking,
    deleteStaffCalendarBooking,
    checkAvailability
};
