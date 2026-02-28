const Booking = require('../models/Booking.model');
const Court = require('../models/Court.model');
const Payment = require('../models/Payment.model');

const moment = require('moment');

/**
 * @desc    Get all bookings for a specific day grouped by court
 * @route   GET /api/calendar/day
 * @access  Private (Admin, Staff)
 */
const getDayCalendar = async (req, res) => {
    try {
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a date (YYYY-MM-DD)'
            });
        }

        // Parse date to start and end of day
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // 1. Fetch all active courts
        const courts = await Court.find({ status: 'ACTIVE' }).lean();

        // 2. Fetch all bookings for the selected date
        // We exclude CANCELLED bookings as they don't occupy slots
        const bookings = await Booking.find({
            bookingDate: {
                $gte: startOfDay,
                $lte: endOfDay
            },
            status: { $ne: 'CANCELLED' }
        }).populate('courtId', 'name sportType').lean();

        // 3. Fetch payment details for these bookings
        const bookingIds = bookings.map(b => b._id);
        const payments = await Payment.find({
            bookingId: { $in: bookingIds }
        }).lean();

        // Map payments to bookings for easy access
        const paymentMap = payments.reduce((acc, payment) => {
            acc[payment.bookingId.toString()] = payment;
            return acc;
        }, {});

        // 4. Group bookings by court
        const calendarData = courts.map(court => {
            const courtBookings = bookings
                .filter(b => b.courtId._id.toString() === court._id.toString())
                .map(b => {
                    const payment = paymentMap[b._id.toString()];

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
                        customerPhone: b.customerPhone,
                        sportType: b.sportType,
                        courtId: court._id,
                        bookingDate: b.bookingDate,
                        startTime: b.startTime,
                        endTime: b.endTime,
                        discountType: b.discountType,
                        discountValue: b.discountValue,
                        paymentStatus: payment ? payment.status : 'PENDING',
                        paymentMode: payment ? payment.paymentMode : 'CASH',
                        paymentNotes: payment ? payment.paymentNotes : '',
                        bookingStatus: displayStatus,
                        finalAmount: b.finalAmount,
                        advancePaid: payment ? payment.advancePaid : 0,
                        balanceAmount: payment ? payment.balanceAmount : b.finalAmount,
                        source: b.source || 'MANUAL',
                        isReadOnly: b.source === 'RECURRING',
                        disableEdit: b.source === 'RECURRING',
                        disableDelete: b.source === 'RECURRING'
                    };
                });

            return {
                courtId: court._id,
                courtName: court.name,
                sportType: court.sportType,
                slots: courtBookings // These are the booked slots
            };
        });

        res.status(200).json({
            success: true,
            date,
            courts: calendarData
        });

    } catch (error) {
        console.error('Error in getDayCalendar:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error while fetching calendar data'
        });
    }
};

module.exports = {
    getDayCalendar
};
