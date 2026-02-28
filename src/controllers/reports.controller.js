const mongoose = require('mongoose');
const moment = require('moment');
const Booking = require('../models/Booking.model');
const Payment = require('../models/Payment.model');
const Court = require('../models/Court.model');

/**
 * GET /api/admin/reports/daily
 * Query: date (YYYY-MM-DD), courtId (optional)
 */
const getDailyReport = async (req, res) => {
    try {
        const { date, courtId } = req.query;
        if (!date) return res.status(400).json({ message: 'Date is required' });

        const searchDate = new Date(date);
        const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));

        const match = {
            bookingDate: { $gte: startOfDay, $lte: endOfDay },
            status: { $ne: 'CANCELLED' }
        };

        if (courtId) {
            match.courtId = new mongoose.Types.ObjectId(courtId);
        }

        const reportData = await Booking.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: 'payments',
                    localField: '_id',
                    foreignField: 'bookingId',
                    as: 'paymentInfo'
                }
            },
            { $unwind: '$paymentInfo' },
            {
                $lookup: {
                    from: 'courts',
                    localField: 'courtId',
                    foreignField: '_id',
                    as: 'courtDetails'
                }
            },
            { $unwind: '$courtDetails' },
            {
                $group: {
                    _id: null,
                    totalBookings: { $sum: 1 },
                    totalRevenue: { $sum: { $subtract: ['$paymentInfo.totalAmount', '$paymentInfo.balanceAmount'] } },
                    pendingBalance: { $sum: '$paymentInfo.balanceAmount' },
                    bookings: {
                        $push: {
                            bookingId: '$_id',
                            customerName: '$customerName',
                            court: '$courtDetails.name',
                            time: { $concat: ['$startTime', ' - ', '$endTime'] },
                            totalAmount: '$paymentInfo.totalAmount',
                            balance: '$paymentInfo.balanceAmount'
                        }
                    }
                }
            }
        ]);

        if (reportData.length === 0) {
            return res.json({
                totalBookings: 0,
                totalRevenue: 0,
                pendingBalance: 0,
                bookings: []
            });
        }

        res.json(reportData[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/admin/reports/monthly
 * Query: month (YYYY-MM)
 */
const getMonthlyReport = async (req, res) => {
    try {
        const { month } = req.query;
        if (!month) return res.status(400).json({ message: 'Month (YYYY-MM) is required' });

        const [year, monthVal] = month.split('-').map(Number);
        const startOfMonth = new Date(year, monthVal - 1, 1);
        const endOfMonth = new Date(year, monthVal, 0, 23, 59, 59, 999);

        const monthlyData = await Booking.aggregate([
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
                    as: 'pay'
                }
            },
            { $unwind: '$pay' },
            {
                $facet: {
                    summary: [
                        {
                            $group: {
                                _id: null,
                                totalBookings: { $sum: 1 },
                                totalCollection: { $sum: { $subtract: ['$pay.totalAmount', '$pay.balanceAmount'] } },
                                pendingBalance: { $sum: '$pay.balanceAmount' }
                            }
                        }
                    ],
                    dailyTrend: [
                        {
                            $group: {
                                _id: { $dayOfMonth: '$bookingDate' },
                                bookings: { $sum: 1 },
                                revenue: { $sum: { $subtract: ['$pay.totalAmount', '$pay.balanceAmount'] } }
                            }
                        },
                        { $sort: { '_id': 1 } },
                        {
                            $project: {
                                day: '$_id',
                                bookings: 1,
                                revenue: 1,
                                _id: 0
                            }
                        },
                    ]
                }
            }
        ]);

        const result = {
            summary: monthlyData[0].summary[0] || { totalBookings: 0, totalCollection: 0, pendingBalance: 0 },
            dailyTrend: []
        };

        // 2. Get NEW Recurring Rules in this month (for Advance Revenue & Counts)
        const RecurringBooking = require('../models/RecurringBooking.model');
        const newRulesInMonth = await RecurringBooking.find({
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        });

        let totalAdvanceRevenue = 0;
        const advanceTrendMap = {}; // day -> { revenue, bookings }

        newRulesInMonth.forEach(rule => {
            const day = rule.createdAt.getDate();
            if (!advanceTrendMap[day]) advanceTrendMap[day] = { revenue: 0, bookings: 0 };

            const amount = rule.advancePaid || 0;
            totalAdvanceRevenue += amount;
            advanceTrendMap[day].revenue += amount;
            advanceTrendMap[day].bookings += 1; // Count each rule creation as a booking event
        });

        // Merge Summary
        result.summary.totalCollection += totalAdvanceRevenue;
        result.summary.totalBookings += newRulesInMonth.length;

        // 3. Prepare Daily Trend with ALL days of the month
        const trendMap = {}; // day -> { bookings, revenue }
        monthlyData[0].dailyTrend.forEach(d => {
            trendMap[d.day] = { bookings: d.bookings, revenue: d.revenue };
        });

        // Get total days in the month
        const daysInMonth = moment(startOfMonth).daysInMonth();
        const dailyTrend = [];

        for (let i = 1; i <= daysInMonth; i++) {
            const data = trendMap[i] || { bookings: 0, revenue: 0 };
            const advance = advanceTrendMap[i] || { bookings: 0, revenue: 0 };

            dailyTrend.push({
                day: i,
                bookings: data.bookings + advance.bookings,
                revenue: data.revenue + advance.revenue
            });
        }

        result.dailyTrend = dailyTrend;

        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching monthly report:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * GET /api/admin/reports/revenue
 * Query: from (YYYY-MM-DD), to (YYYY-MM-DD)
 */
const getRevenueReport = async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ message: 'From and To dates are required' });

        const startDate = new Date(from);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);

        const report = await Booking.aggregate([
            {
                $match: {
                    bookingDate: { $gte: startDate, $lte: endDate },
                    status: { $ne: 'CANCELLED' }
                }
            },
            {
                $lookup: {
                    from: 'payments',
                    localField: '_id',
                    foreignField: 'bookingId',
                    as: 'pay'
                }
            },
            { $unwind: '$pay' },
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
                $facet: {
                    totals: [
                        {
                            $group: {
                                _id: null,
                                totalRevenue: { $sum: { $subtract: ['$pay.totalAmount', '$pay.balanceAmount'] } }
                            }
                        }
                    ],
                    trend: [
                        {
                            $group: {
                                _id: { $dateToString: { format: '%Y-%m-%d', date: '$bookingDate' } },
                                amount: { $sum: { $subtract: ['$pay.totalAmount', '$pay.balanceAmount'] } }
                            }
                        },
                        { $sort: { '_id': 1 } },
                        { $project: { date: '$_id', amount: 1, _id: 0 } }
                    ],
                    weekdayVsWeekend: [
                        {
                            $addFields: {
                                dayOfWeek: { $dayOfWeek: '$bookingDate' } // 1 (Sun) to 7 (Sat)
                            }
                        },
                        {
                            $group: {
                                _id: {
                                    $cond: {
                                        if: { $in: ['$dayOfWeek', [1, 7]] },
                                        then: 'weekend',
                                        else: 'weekday'
                                    }
                                },
                                amount: { $sum: { $subtract: ['$pay.totalAmount', '$pay.balanceAmount'] } }
                            }
                        }
                    ],
                    courtWise: [
                        {
                            $group: {
                                _id: '$court.name',
                                amount: { $sum: { $subtract: ['$pay.totalAmount', '$pay.balanceAmount'] } }
                            }
                        },
                        { $project: { court: '$_id', amount: 1, _id: 0 } }
                    ]
                }
            }
        ]);

        // 2. NEW Recurring Rules (Advance Revenue)
        const RecurringBooking = require('../models/RecurringBooking.model');
        const newRulesInPeriod = await RecurringBooking.find({
            createdAt: { $gte: startDate, $lte: endDate },
            advancePaid: { $gt: 0 }
        }).populate('courtId', 'name');

        let totalAdvanceRevenue = 0;
        const advanceTrendMap = {};
        const advanceCourtMap = {};
        const advanceWeekdayWeekend = { weekday: 0, weekend: 0 };

        newRulesInPeriod.forEach(rule => {
            const amount = rule.advancePaid || 0;
            totalAdvanceRevenue += amount;

            // Trend
            const dateStr = rule.createdAt.toISOString().split('T')[0];
            advanceTrendMap[dateStr] = (advanceTrendMap[dateStr] || 0) + amount;

            // Court
            const courtName = rule.courtId ? rule.courtId.name : 'Unknown';
            advanceCourtMap[courtName] = (advanceCourtMap[courtName] || 0) + amount;

            // Weekday vs Weekend
            const day = rule.createdAt.getDay(); // 0 (Sun) to 6 (Sat)
            if (day === 0 || day === 6) {
                advanceWeekdayWeekend.weekend += amount;
            } else {
                advanceWeekdayWeekend.weekday += amount;
            }
        });

        const totals = report[0].totals[0] || { totalRevenue: 0 };
        const weekdayVsWeekend = { weekday: 0, weekend: 0 };
        report[0].weekdayVsWeekend.forEach(item => {
            weekdayVsWeekend[item._id] = item.amount;
        });

        // Merge Advance
        totals.totalRevenue += totalAdvanceRevenue;
        weekdayVsWeekend.weekday += advanceWeekdayWeekend.weekday;
        weekdayVsWeekend.weekend += advanceWeekdayWeekend.weekend;

        // Merge Trend
        let trend = report[0].trend;
        const trendMap = {};
        trend.forEach(t => { trendMap[t.date] = t; });
        Object.keys(advanceTrendMap).forEach(date => {
            if (trendMap[date]) {
                trendMap[date].amount += advanceTrendMap[date];
            } else {
                trendMap[date] = { date, amount: advanceTrendMap[date] };
            }
        });
        trend = Object.values(trendMap).sort((a, b) => new Date(a.date) - new Date(b.date));

        // Merge Court Wise
        let courtWise = report[0].courtWise;
        const courtMap = {};
        courtWise.forEach(c => { courtMap[c.court] = c; });
        Object.keys(advanceCourtMap).forEach(court => {
            if (courtMap[court]) {
                courtMap[court].amount += advanceCourtMap[court];
            } else {
                courtMap[court] = { court, amount: advanceCourtMap[court] };
            }
        });
        courtWise = Object.values(courtMap);

        res.json({
            totalRevenue: totals.totalRevenue,
            revenueTrend: trend,
            weekdayVsWeekend,
            courtWise
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/admin/reports/pending
 */
const getPendingBalanceReport = async (req, res) => {
    try {
        const pendingData = await Payment.aggregate([
            { $match: { balanceAmount: { $gt: 0 } } },
            {
                $lookup: {
                    from: 'bookings',
                    localField: 'bookingId',
                    foreignField: '_id',
                    as: 'booking'
                }
            },
            { $unwind: '$booking' },
            {
                $match: { 'booking.status': { $ne: 'CANCELLED' } }
            },
            {
                $lookup: {
                    from: 'courts',
                    localField: 'booking.courtId',
                    foreignField: '_id',
                    as: 'court'
                }
            },
            { $unwind: '$court' },
            {
                $group: {
                    _id: null,
                    totalPending: { $sum: '$balanceAmount' },
                    pendingBookings: {
                        $push: {
                            customerName: '$booking.customerName',
                            court: '$court.name',
                            balance: '$balanceAmount',
                            bookingDate: { $dateToString: { format: '%Y-%m-%d', date: '$booking.bookingDate' } }
                        }
                    }
                }
            }
        ]);

        // Fetch Recurring Booking Pending Balances
        const RecurringBooking = require('../models/RecurringBooking.model');
        const recurringPending = await RecurringBooking.find({
            paymentStatus: { $in: ['PENDING', 'PARTIAL'] },
            status: { $in: ['ACTIVE', 'PAUSED'] } // Only active/paused rules
        }).populate('courtId', 'name');

        let totalRecurringPending = 0;
        const recurringPendingItems = [];

        recurringPending.forEach(rule => {
            // Assume monthlyAmount is the total deal value for now, or fallback logic
            const total = rule.monthlyAmount || 0;
            const paid = rule.advancePaid || 0;
            const pending = total - paid;

            if (pending > 0) {
                totalRecurringPending += pending;
                recurringPendingItems.push({
                    customerName: rule.customerName + ' (Recurring)',
                    court: rule.courtId ? rule.courtId.name : 'Unknown',
                    balance: pending,
                    bookingDate: rule.createdAt.toISOString().split('T')[0] // Use creation date for list
                });
            }
        });

        const totalPending = (pendingData[0]?.totalPending || 0) + totalRecurringPending;
        const pendingBookings = [...(pendingData[0]?.pendingBookings || []), ...recurringPendingItems];

        if (totalPending === 0 && pendingBookings.length === 0) {
            return res.json({ totalPending: 0, pendingBookings: [] });
        }

        res.json({
            totalPending,
            pendingBookings: pendingBookings.sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/admin/reports/recurring
 * Query: from (YYYY-MM-DD), to (YYYY-MM-DD)
 */
const getRecurringBookingReport = async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ message: 'From and To dates are required' });

        const startDate = new Date(from);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);

        console.log('📅 Date Range:', { from, to, startDate, endDate });

        const RecurringBooking = require('../models/RecurringBooking.model');

        // 1. Get ALL recurring rules active in the period (for displaying the list)
        // Rule overlaps with range if: (Start <= RangeEnd) AND (End >= RangeStart OR End is null)
        const recurringRules = await RecurringBooking.find({
            $or: [
                { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
                { startDate: { $lte: endDate }, endDate: null }
            ]
        }).populate('courtId', 'name sportType');

        // 2. Get NEW recurring rules created in this period (for Advance Payment Revenue)
        // We consider advance payment as revenue "collected" on the day the rule was created.
        const newRulesInPeriod = await RecurringBooking.find({
            createdAt: { $gte: startDate, $lte: endDate },
            advancePaid: { $gt: 0 }
        }).populate('courtId', 'name');

        let totalAdvanceRevenue = 0;
        const advanceTrendMap = {}; // date -> amount
        const advanceCourtMap = {}; // courtName -> amount

        newRulesInPeriod.forEach(rule => {
            const amount = rule.advancePaid || 0;
            totalAdvanceRevenue += amount;

            // Trend
            const day = rule.createdAt.toISOString().split('T')[0];
            advanceTrendMap[day] = (advanceTrendMap[day] || 0) + amount;

            // Court
            const courtName = rule.courtId ? rule.courtId.name : 'Unknown';
            advanceCourtMap[courtName] = (advanceCourtMap[courtName] || 0) + amount;
        });

        console.log('💰 Advance Revenue from New Rules:', totalAdvanceRevenue);


        // 3. Get bookings generated from recurring rules (Accrual/Consumption Revenue)
        const recurringBookings = await Booking.aggregate([
            {
                $match: {
                    bookingSource: 'RECURRING',
                    bookingDate: { $gte: startDate, $lte: endDate },
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
                $lookup: {
                    from: 'courts',
                    localField: 'courtId',
                    foreignField: '_id',
                    as: 'court'
                }
            },
            {
                $unwind: {
                    path: '$court',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $facet: {
                    summary: [
                        {
                            $group: {
                                _id: null,
                                totalBookings: { $sum: 1 },
                                totalRevenue: {
                                    $sum: {
                                        $cond: [
                                            { $ifNull: ['$payment', false] },
                                            {
                                                $subtract: [
                                                    { $ifNull: ['$payment.totalAmount', 0] },
                                                    { $ifNull: ['$payment.balanceAmount', 0] }
                                                ]
                                            },
                                            0
                                        ]
                                    }
                                },
                                pendingBalance: {
                                    $sum: { $ifNull: ['$payment.balanceAmount', 0] }
                                }
                            }
                        }
                    ],
                    statusBreakdown: [
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    courtWise: [
                        {
                            $group: {
                                _id: { $ifNull: ['$court.name', 'Unknown'] },
                                bookings: { $sum: 1 },
                                revenue: {
                                    $sum: {
                                        $cond: [
                                            { $ifNull: ['$payment', false] },
                                            {
                                                $subtract: [
                                                    { $ifNull: ['$payment.totalAmount', 0] },
                                                    { $ifNull: ['$payment.balanceAmount', 0] }
                                                ]
                                            },
                                            0
                                        ]
                                    }
                                }
                            }
                        },
                        { $project: { court: '$_id', bookings: 1, revenue: 1, _id: 0 } }
                    ],
                    dailyTrend: [
                        {
                            $group: {
                                _id: { $dateToString: { format: '%Y-%m-%d', date: '$bookingDate' } },
                                bookings: { $sum: 1 },
                                revenue: {
                                    $sum: {
                                        $cond: [
                                            { $ifNull: ['$payment', false] },
                                            {
                                                $subtract: [
                                                    { $ifNull: ['$payment.totalAmount', 0] },
                                                    { $ifNull: ['$payment.balanceAmount', 0] }
                                                ]
                                            },
                                            0
                                        ]
                                    }
                                }
                            }
                        },
                        { $sort: { '_id': 1 } },
                        { $project: { date: '$_id', bookings: 1, revenue: 1, _id: 0 } }
                    ]
                }
            }
        ]);

        const summaryRes = recurringBookings[0].summary[0] || { totalBookings: 0, totalRevenue: 0, pendingBalance: 0 };
        const statusBreakdown = recurringBookings[0].statusBreakdown;
        let courtWise = recurringBookings[0].courtWise;
        let dailyTrend = recurringBookings[0].dailyTrend;

        // 4. Merge Advance Revenue into Results

        // A. Summary
        summaryRes.totalRevenue += totalAdvanceRevenue;

        // B. Daily Trend (Merge/Add)
        // Convert array to map for easy update
        const trendMap = {};
        dailyTrend.forEach(d => {
            trendMap[d.date] = d;
        });

        Object.keys(advanceTrendMap).forEach(date => {
            if (trendMap[date]) {
                trendMap[date].revenue += advanceTrendMap[date];
            } else {
                trendMap[date] = { date, bookings: 0, revenue: advanceTrendMap[date] };
            }
        });

        // Convert back to sorted array
        dailyTrend = Object.values(trendMap).sort((a, b) => new Date(a.date) - new Date(b.date));


        // C. Court Wise (Merge/Add)
        const courtMap = {};
        courtWise.forEach(c => {
            courtMap[c.court] = c;
        });

        Object.keys(advanceCourtMap).forEach(courtName => {
            if (courtMap[courtName]) {
                courtMap[courtName].revenue += advanceCourtMap[courtName];
            } else {
                courtMap[courtName] = { court: courtName, bookings: 0, revenue: advanceCourtMap[courtName] };
            }
        });

        courtWise = Object.values(courtMap);


        res.json({
            totalRules: recurringRules.length,
            activeRules: recurringRules.filter(r => r.status === 'ACTIVE').length,
            pausedRules: recurringRules.filter(r => r.status === 'PAUSED').length,
            summary: summaryRes,
            statusBreakdown,
            courtWise,
            dailyTrend,
            rules: recurringRules.map(r => ({
                _id: r._id,
                customerName: r.customerName,
                court: r.courtId?.name,
                sportType: r.courtId?.sportType,
                recurrenceType: r.recurrenceType,
                daysOfWeek: r.daysOfWeek,
                timeSlot: `${r.startTime} - ${r.endTime}`,
                status: r.status,
                startDate: r.startDate,
                endDate: r.endDate,
                advancePaid: r.advancePaid // Added for visibility if needed
            }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getDailyReport,
    getMonthlyReport,
    getRevenueReport,
    getPendingBalanceReport,
    getRecurringBookingReport
};
