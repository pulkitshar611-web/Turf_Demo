const cron = require('node-cron');
const moment = require('moment');
const Booking = require('../models/Booking.model');
const BookingSlot = require('../models/BookingSlot.model');
const mongoose = require('mongoose');

/**
 * Background job to automatically complete bookings that have ended.
 * Runs every 5 minutes.
 */
const initBookingCron = () => {
    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        console.log('[CRON] Checking for expired bookings...');
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const now = moment();
            const today = now.format('YYYY-MM-DD');
            const currentTime = now.format('HH:mm');

            // Find bookings that have ended
            // 1. Same day, endTime <= currentTime
            // 2. Or any previous day
            const expiredBookings = await Booking.find({
                status: 'BOOKED',
                $or: [
                    {
                        bookingDate: { $lt: moment().startOf('day').toDate() }
                    },
                    {
                        bookingDate: {
                            $gte: moment().startOf('day').toDate(),
                            $lte: moment().endOf('day').toDate()
                        },
                        endTime: { $lte: currentTime }
                    }
                ]
            }).session(session);

            if (expiredBookings.length > 0) {
                console.log(`[CRON] Completing ${expiredBookings.length} bookings...`);
                const bookingIds = expiredBookings.map(b => b._id);

                // Update Bookings
                await Booking.updateMany(
                    { _id: { $in: bookingIds } },
                    { status: 'COMPLETED' },
                    { session }
                );

                // Update BookingSlots
                await BookingSlot.updateMany(
                    { bookingId: { $in: bookingIds } },
                    { status: 'COMPLETED' },
                    { session }
                );

                console.log(`[CRON] Successfully completed ${expiredBookings.length} bookings.`);
            }

            await session.commitTransaction();
        } catch (error) {
            await session.abortTransaction();
            console.error('[CRON ERROR]:', error);
        } finally {
            session.endSession();
        }
    });

    console.log('[CRON] Booking Auto-Complete Job Initialized (Every 5 mins)');
};

module.exports = { initBookingCron };
