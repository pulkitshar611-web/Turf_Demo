const mongoose = require('mongoose');
const Booking = require('../models/Booking.model');
const Payment = require('../models/Payment.model');
const Court = require('../models/Court.model');
const moment = require('moment');

/**
 * @desc    Get Staff Dashboard Summary
 * @route   GET /api/staff/dashboard/summary
 * @access  Private (Staff, Admin)
 */
exports.getStaffDashboardSummary = async (req, res) => {
    try {
        const today = moment().startOf('day').toDate();
        const tomorrow = moment(today).add(1, 'days').toDate();
        const currentTime = moment().format('HH:mm');

        const summary = await Booking.aggregate([
            {
                $match: {
                    bookingDate: { $gte: today, $lt: tomorrow },
                    status: { $ne: 'CANCELLED' }
                }
            },
            {
                $lookup: {
                    from: 'payments',
                    localField: '_id',
                    foreignField: 'bookingId',
                    as: 'payment'
                }
            },
            {
                $unwind: {
                    path: '$payment',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $facet: {
                    counts: [
                        {
                            $group: {
                                _id: null,
                                todayBookings: { $sum: 1 },
                                todayScheduled: { $sum: 1 }, // Matches for today
                                pendingBalanceCount: {
                                    $sum: {
                                        $cond: [{ $ne: ['$payment.status', 'PAID'] }, 1, 0]
                                    }
                                },
                                ongoingUpcoming: {
                                    $sum: {
                                        $cond: [{ $gt: ['$endTime', currentTime] }, 1, 0]
                                    }
                                }
                            }
                        }
                    ]
                }
            }
        ]);

        const stats = summary[0].counts[0] || {
            todayBookings: 0,
            todayScheduled: 0,
            pendingBalanceCount: 0,
            ongoingUpcoming: 0
        };

        delete stats._id;

        res.status(200).json(stats);
    } catch (error) {
        console.error('Staff Dashboard Summary Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Get Bookings Per Day (Line Chart)
 * @route   GET /api/staff/dashboard/bookings-per-day
 * @access  Private (Staff, Admin)
 */
exports.getBookingsPerDay = async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) {
            return res.status(400).json({ message: 'From and To dates are required' });
        }

        const startDate = moment(from).startOf('day').toDate();
        const endDate = moment(to).endOf('day').toDate();

        const data = await Booking.aggregate([
            {
                $match: {
                    bookingDate: { $gte: startDate, $lte: endDate },
                    status: { $ne: 'CANCELLED' }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$bookingDate' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    date: '$_id',
                    count: 1,
                    _id: 0
                }
            }
        ]);

        res.status(200).json(data);
    } catch (error) {
        console.error('Staff Dashboard Bookings Per Day Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Get Payment Status Distribution (Donut Chart)
 * @route   GET /api/staff/dashboard/payment-status
 * @access  Private (Staff, Admin)
 */
exports.getPaymentStatusDistribution = async (req, res) => {
    try {
        const distribution = await Booking.aggregate([
            {
                $match: { status: { $ne: 'CANCELLED' } }
            },
            {
                $lookup: {
                    from: 'payments',
                    localField: '_id',
                    foreignField: 'bookingId',
                    as: 'payment'
                }
            },
            { $unwind: '$payment' },
            {
                $group: {
                    _id: '$payment.status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = {
            advancePending: 0,
            balancePending: 0,
            fullyPaid: 0
        };

        distribution.forEach(item => {
            if (item._id === 'PENDING') result.advancePending = item.count;
            if (item._id === 'PARTIAL') result.balancePending = item.count;
            if (item._id === 'PAID') result.fullyPaid = item.count;
        });

        res.status(200).json(result);
    } catch (error) {
        console.error('Staff Dashboard Payment Status Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Get Court Utilization (Bar Chart)
 * @route   GET /api/staff/dashboard/court-utilization
 * @access  Private (Staff, Admin)
 */
exports.getCourtUtilization = async (req, res) => {
    try {
        const utilization = await Booking.aggregate([
            {
                $match: { status: { $ne: 'CANCELLED' } }
            },
            {
                $lookup: {
                    from: 'courts',
                    localField: 'courtId',
                    foreignField: '_id',
                    as: 'court'
                }
            },
            { $unwind: '$court' },
            {
                $group: {
                    _id: '$court.name',
                    bookings: { $sum: 1 }
                }
            },
            { $sort: { bookings: -1 } },
            {
                $project: {
                    court: '$_id',
                    bookings: 1,
                    _id: 0
                }
            }
        ]);

        res.status(200).json(utilization);
    } catch (error) {
        console.error('Staff Dashboard Court Utilization Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
