const mongoose = require('mongoose');
const moment = require('moment');
const Booking = require('../models/Booking.model');
const BookingSlot = require('../models/BookingSlot.model');
const Court = require('../models/Court.model');
const Payment = require('../models/Payment.model');
const Settings = require('../models/Settings.model');
const { generateSlots } = require('../services/slotGenerator.service');
const { calculatePrice } = require('../services/pricing.service');
const { checkSlotAvailability, throwConflictError } = require('../services/slotValidation.service');

/**
 * @desc    Get Bookings List (Staff View)
 * @route   GET /api/staff/bookings
 */
const getBookingsList = async (req, res) => {
    try {
        const { date, fromDate, toDate, courtId, paymentStatus, page = 1, limit = 10 } = req.query;

        // Default: Show all manual bookings (include legacy records without source)
        const query = { source: { $ne: 'RECURRING' } };

        // Filters
        if (date) {
            const startOfDay = moment(date).startOf('day').toDate();
            const endOfDay = moment(date).endOf('day').toDate();
            query.bookingDate = { $gte: startOfDay, $lte: endOfDay };
        } else if (fromDate && toDate) {
            query.bookingDate = {
                $gte: moment(fromDate).startOf('day').toDate(),
                $lte: moment(toDate).endOf('day').toDate()
            };
        }

        if (courtId) {
            query.courtId = courtId;
        }

        // Pagination
        const skip = (page - 1) * limit;

        // Fetch Bookings with Court and Payment
        console.log('Fetching bookings with query:', JSON.stringify(query));
        let bookings = await Booking.find(query)
            .populate('courtId', 'name sportType')
            .sort({ bookingDate: -1, startTime: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        console.log(`Found ${bookings.length} bookings`);

        const total = await Booking.countDocuments(query);

        // Map Payment Data and Status
        const formattedBookings = await Promise.all(bookings.map(async (b) => {
            const payment = await Payment.findOne({ bookingId: b._id });

            // ... (payment status logic remains)
            let ps = 'ADVANCE_PENDING';
            if (payment) {
                if (payment.balanceAmount === 0) {
                    ps = 'PAID';
                } else if (payment.advancePaid > 0) {
                    ps = 'BALANCE_PENDING';
                }
            }

            // Exclude record if filtered by paymentStatus
            if (paymentStatus && ps !== paymentStatus) return null;

            // Dynamic Status Logic
            let displayStatus = b.status;
            if (b.status === 'BOOKED') {
                const now = moment();
                const bookingEnd = moment(moment(b.bookingDate).format('YYYY-MM-DD') + ' ' + b.endTime, 'YYYY-MM-DD HH:mm');
                if (now.isAfter(bookingEnd)) {
                    displayStatus = 'COMPLETED';
                }
            }

            return {
                bookingId: b._id.toString(),
                customerName: b.customerName,
                phoneNumber: b.customerPhone,
                courtName: b.courtId ? `${b.courtId.sportType} - ${b.courtId.name}` : 'N/A',
                bookingDate: moment(b.bookingDate).format('YYYY-MM-DD'),
                timeSlot: `${b.startTime} - ${b.endTime}`,
                startTime: b.startTime,
                endTime: b.endTime,
                totalAmount: b.finalAmount,
                advancePaid: payment ? payment.advancePaid : 0,
                dueBalance: payment ? payment.balanceAmount : b.finalAmount,
                paymentStatus: ps,
                status: displayStatus // Dynamically calculated
            };
        }));

        // Clean up nulls from paymentStatus filter
        const result = formattedBookings.filter(item => item !== null);

        res.status(200).json({
            success: true,
            total: result.length,
            totalInDb: total,
            page: parseInt(page),
            data: result
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get Booking Details
 * @route   GET /api/staff/bookings/:id
 */
const getBookingDetails = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('courtId', 'name sportType weekdayPrice weekendPrice')
            .populate('createdBy', 'name email');

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        const payment = await Payment.findOne({ bookingId: booking._id });

        res.status(200).json({
            success: true,
            data: {
                ...booking._doc,
                payment: payment || null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Create new booking by Staff/Admin
 * @route   POST /api/staff/bookings
 */
const createStaffBooking = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            customerName,
            phoneNumber,
            bookingDate,
            startTime,
            endTime,
            courtId,
            sport,
            advancePaid,
            remainingBalance,
            paymentMode
        } = req.body;

        // Validation logic same as before but ensuring bookingSource: 'MANUAL'
        if (!customerName || !phoneNumber || !bookingDate || !startTime || !endTime || !courtId || !sport) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (!/^\d{10}$/.test(phoneNumber)) {
            return res.status(400).json({ message: 'Please provide a valid 10-digit phone number' });
        }

        const settings = await Settings.getSettings();
        const start = moment(startTime, 'HH:mm');
        const end = moment(endTime, 'HH:mm');
        const open = moment(settings.openingTime, 'HH:mm');
        const close = moment(settings.closingTime, 'HH:mm');

        if (start.isBefore(open) || end.isAfter(close)) {
            return res.status(400).json({
                message: `Booking must be within operating hours (${settings.openingTime} - ${settings.closingTime})`
            });
        }

        const court = await Court.findById(courtId).session(session);
        if (!court || court.status !== 'ACTIVE') {
            throw new Error('Court not found or inactive');
        }

        const slots = generateSlots(startTime, endTime);
        const bDate = new Date(bookingDate);
        bDate.setHours(0, 0, 0, 0);

        // Global Slot Validation
        const availability = await checkSlotAvailability(courtId, bDate, startTime, endTime, session);
        if (!availability.available) {
            return res.status(409).json({ message: `This slot is already booked. Please select another time. (Conflicts: ${availability.conflicts.join(', ')})` });
        }

        const baseAmount = calculatePrice(court, slots.length, bDate);
        const totalAmount = Math.ceil(baseAmount);
        const calculatedRemaining = Math.max(0, totalAmount - (advancePaid || 0));

        const booking = await Booking.create([{
            customerName,
            customerPhone: phoneNumber,
            sportType: sport,
            courtId,
            bookingDate: bDate,
            startTime,
            endTime,
            totalSlots: slots.length,
            baseAmount: totalAmount,
            discountType: 'NONE',
            discountValue: 0,
            finalAmount: totalAmount,
            createdBy: req.user._id,
            status: 'BOOKED',
            source: 'MANUAL'
        }], { session });

        await BookingSlot.insertMany(slots.map(time => ({
            bookingId: booking[0]._id,
            courtId,
            bookingDate: bDate,
            slotTime: time
        })), { session });

        await Payment.create([{
            bookingId: booking[0]._id,
            totalAmount,
            advancePaid: advancePaid || 0,
            balanceAmount: calculatedRemaining,
            paymentMode: paymentMode || 'CASH',
            status: calculatedRemaining === 0 ? 'PAID' : (advancePaid > 0 ? 'PARTIAL' : 'PENDING')
        }], { session });

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({ success: true, message: 'Booking created successfully', booking: booking[0] });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Update Booking (Limited for STAFF)
 * @route   PUT /api/staff/bookings/:id
 */
const updateBooking = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const { customerName, customerPhone, startTime, endTime, advancePaid } = req.body;

        const booking = await Booking.findById(id).session(session);
        if (!booking) throw new Error('Booking not found');
        if (booking.status === 'CANCELLED') throw new Error('Cannot edit a cancelled booking');
        if (booking.source === 'RECURRING') throw new Error('Cannot edit a recurring booking via this endpoint');

        // Only update allowed fields
        if (customerName) booking.customerName = customerName;
        if (customerPhone) booking.customerPhone = customerPhone;

        // Time Slot change logic
        if (startTime && endTime && (startTime !== booking.startTime || endTime !== booking.endTime)) {
            const slots = generateSlots(startTime, endTime);

            // Check conflicts (excluding current booking)
            const conflicts = await BookingSlot.find({
                courtId: booking.courtId,
                bookingDate: booking.bookingDate,
                slotTime: { $in: slots },
                bookingId: { $ne: booking._id }
            }).populate('bookingId').session(session);

            const activeConflicts = conflicts.filter(s => s.bookingId && s.bookingId.status === 'BOOKED');
            if (activeConflicts.length > 0) {
                throw new Error('New time slot overlaps with another booking');
            }

            // Update slots
            await BookingSlot.deleteMany({ bookingId: booking._id }).session(session);
            await BookingSlot.insertMany(slots.map(s => ({
                bookingId: booking._id,
                courtId: booking.courtId,
                bookingDate: booking.bookingDate,
                slotTime: s
            })), { session });

            booking.startTime = startTime;
            booking.endTime = endTime;
            booking.totalSlots = slots.length;

            // Recalculate price if slots count changed
            const court = await Court.findById(booking.courtId).session(session);
            const newBase = calculatePrice(court, slots.length, booking.bookingDate);
            booking.baseAmount = newBase;
            booking.finalAmount = newBase; // No discount for staff updates
        }

        await booking.save({ session });

        // Update Payment if advancePaid changed or time slot changed
        const payment = await Payment.findOne({ bookingId: booking._id }).session(session);
        if (payment) {
            payment.totalAmount = booking.finalAmount;
            if (advancePaid !== undefined) payment.advancePaid = advancePaid;
            payment.balanceAmount = payment.totalAmount - payment.advancePaid;
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
 * @desc    Cancel Booking
 * @route   PATCH /api/staff/bookings/:id/cancel
 */
const cancelBooking = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const booking = await Booking.findById(req.params.id).session(session);
        if (!booking) throw new Error('Booking not found');
        if (booking.status === 'CANCELLED') throw new Error('Booking already cancelled');

        booking.status = 'CANCELLED';
        await booking.save({ session });

        // Update slots to CANCELLED
        await BookingSlot.updateMany(
            { bookingId: booking._id },
            { status: 'CANCELLED' }
        ).session(session);

        // Keep payment record for audit, but maybe update notes
        const payment = await Payment.findOne({ bookingId: booking._id }).session(session);
        if (payment) {
            payment.paymentNotes = (payment.paymentNotes || '') + ' [CANCELLED]';
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

/**
 * @desc    Delete Booking (Full Deletion)
 * @route   DELETE /api/staff/bookings/:id
 */
const deleteBooking = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const booking = await Booking.findById(req.params.id).session(session);
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
    getBookingsList,
    getBookingDetails,
    createStaffBooking,
    updateBooking,
    cancelBooking,
    deleteBooking
};
