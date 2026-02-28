const Booking = require('../models/Booking.model');
const Payment = require('../models/Payment.model');
const mongoose = require('mongoose');

/**
 * @desc    Get Dashboard Summary KPIs
 * @route   GET /api/admin/dashboard/summary
 * @access  Admin
 */
exports.getDashboardSummary = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

        // Date matchers
        const todayMatch = {
            bookingDate: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
            status: { $ne: 'CANCELLED' }
        };
        const monthMatch = {
            bookingDate: { $gte: startOfMonth, $lte: endOfMonth },
            status: { $ne: 'CANCELLED' }
        };
        const lifetimeMatch = {
            status: { $ne: 'CANCELLED' }
        };

        const summaryData = await Booking.aggregate([
            {
                $facet: {
                    todayStats: [
                        { $match: todayMatch },
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
                                _id: null,
                                count: { $sum: 1 },
                                revenue: { $sum: { $subtract: ['$payment.totalAmount', '$payment.balanceAmount'] } }
                            }
                        }
                    ],
                    pendingBalance: [
                        { $match: lifetimeMatch },
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
                                _id: null,
                                totalPending: { $sum: '$payment.balanceAmount' }
                            }
                        }
                    ],
                    monthStats: [
                        { $match: monthMatch },
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
                                _id: null,
                                count: { $sum: 1 },
                                collection: { $sum: { $subtract: ['$payment.totalAmount', '$payment.balanceAmount'] } }
                            }
                        }
                    ],
                    lifetimeRevenue: [
                        { $match: lifetimeMatch },
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
                                _id: null,
                                totalRevenue: { $sum: { $subtract: ['$payment.totalAmount', '$payment.balanceAmount'] } }
                            }
                        }
                    ]
                }
            }
        ]);

        const result = summaryData[0];

        res.status(200).json({
            todayBookings: result.todayStats[0]?.count || 0,
            todayRevenue: result.todayStats[0]?.revenue || 0,
            pendingBalance: result.pendingBalance[0]?.totalPending || 0,
            monthBookings: result.monthStats[0]?.count || 0,
            monthCollection: result.monthStats[0]?.collection || 0,
            totalRevenue: result.lifetimeRevenue[0]?.totalRevenue || 0
        });
    } catch (error) {
        console.error('Dashboard Summary Error:', error);
        res.status(500).json({ message: 'Error fetching dashboard summary', error: error.message });
    }
};

/**
 * @desc    Get Monthly Revenue Trend (Daily Breakdown)
 * @route   GET /api/admin/dashboard/monthly-revenue
 * @access  Admin
 */
exports.getMonthlyRevenueTrend = async (req, res) => {
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

        const revenueTrend = await Booking.aggregate([
            {
                $match: {
                    bookingDate: { $gte: startOfMonth, $lte: endOfMonth },
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
            { $unwind: '$payment' },
            {
                $group: {
                    _id: { $dayOfMonth: "$bookingDate" },
                    amount: { $sum: { $subtract: ['$payment.totalAmount', '$payment.balanceAmount'] } }
                }
            },
            { $sort: { "_id": 1 } },
            {
                $project: {
                    day: "$_id",
                    amount: 1,
                    _id: 0
                }
            }
        ]);

        res.status(200).json(revenueTrend);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching monthly revenue trend', error: error.message });
    }
};

/**
 * @desc    Get Payment Status Breakdown (Received vs Pending)
 * @route   GET /api/admin/dashboard/payment-status
 * @access  Admin
 */
exports.getPaymentStatusBreakdown = async (req, res) => {
    try {
        const statusBreakdown = await Booking.aggregate([
            {
                $match: {
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
            { $unwind: '$payment' },
            {
                $group: {
                    _id: null,
                    received: { $sum: { $subtract: ['$payment.totalAmount', '$payment.balanceAmount'] } },
                    pending: { $sum: '$payment.balanceAmount' }
                }
            },
            {
                $project: {
                    _id: 0,
                    received: 1,
                    pending: 1
                }
            }
        ]);

        const result = statusBreakdown[0] || { received: 0, pending: 0 };
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching payment status', error: error.message });
    }
};

/**
 * @desc    Get Weekly Earnings Breakdown
 * @route   GET /api/admin/dashboard/weekly-earnings
 * @access  Admin
 */
exports.getWeeklyEarnings = async (req, res) => {
    try {
        const today = new Date();
        const currentDay = today.getDay(); // 0 (Sun) to 6 (Sat)
        // Adjust to Monday start
        const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
        const startOfWeek = new Date(today.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        const earnings = await Booking.aggregate([
            {
                $match: {
                    bookingDate: { $gte: startOfWeek, $lte: endOfWeek },
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
            { $unwind: '$payment' },
            {
                $group: {
                    _id: { $dayOfWeek: "$bookingDate" },
                    amount: { $sum: { $subtract: ['$payment.totalAmount', '$payment.balanceAmount'] } }
                }
            }
        ]);

        // Map 1-7 (Sun-Sat) to the required response format and ensure all days are present
        const result = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(dayName => {
            const dayIndexInDOW = days.indexOf(dayName) + 1; // MongoDB $dayOfWeek returns 1 (Sun) to 7 (Sat)
            const dayData = earnings.find(e => e._id === dayIndexInDOW);
            return { day: dayName, amount: dayData ? dayData.amount : 0 };
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching weekly earnings', error: error.message });
    }
};
