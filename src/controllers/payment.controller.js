const Payment = require('../models/Payment.model');
const Booking = require('../models/Booking.model');
const Court = require('../models/Court.model');
const mongoose = require('mongoose');

/**
 * GET /api/payments
 * Access: STAFF, ADMIN
 */
const getPaymentsList = async (req, res) => {
    try {
        const { dateFrom, dateTo, courtId, paymentStatus } = req.query;
        let query = {};

        // Find bookings that are NOT CANCELLED
        let bookingQuery = { status: { $ne: 'CANCELLED' } };

        if (dateFrom || dateTo) {
            bookingQuery.bookingDate = {};
            if (dateFrom) {
                const start = new Date(dateFrom);
                start.setHours(0, 0, 0, 0);
                bookingQuery.bookingDate.$gte = start;
            }
            if (dateTo) {
                const end = new Date(dateTo);
                end.setHours(23, 59, 59, 999);
                bookingQuery.bookingDate.$lte = end;
            }
        }

        if (courtId) {
            bookingQuery.courtId = courtId;
        }

        const bookings = await Booking.find(bookingQuery).select('_id customerName customerPhone bookingDate startTime endTime courtId finalAmount');
        const bookingIds = bookings.map(b => b._id);

        if (paymentStatus) {
            query.status = paymentStatus;
        }

        query.bookingId = { $in: bookingIds };

        const payments = await Payment.find(query)
            .populate({
                path: 'bookingId',
                populate: { path: 'courtId', select: 'name' },
                select: 'customerName bookingDate startTime endTime finalAmount'
            })
            .sort({ createdAt: -1 });

        const formattedPayments = payments.map(p => ({
            _id: p._id,
            bookingId: p.bookingId?._id,
            bookingRef: `BK-${p.bookingId?._id.toString().slice(-4).toUpperCase()}`,
            customerName: p.bookingId?.customerName,
            courtName: p.bookingId?.courtId?.name,
            bookingDateTime: `${new Date(p.bookingId?.bookingDate).toLocaleDateString()} ${p.bookingId?.startTime} - ${p.bookingId?.endTime}`,
            totalAmount: p.totalAmount,
            advancePaid: p.advancePaid,
            balanceAmount: p.balanceAmount,
            paymentMode: p.paymentMode,
            status: p.status
        }));

        res.json(formattedPayments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * PATCH /api/payments/:id/mark-paid
 * Access: STAFF, ADMIN
 */
const markAsPaid = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentMode, paymentDate } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid Payment ID' });
        }

        const payment = await Payment.findById(id);
        if (!payment) {
            return res.status(404).json({ message: 'Payment record not found' });
        }

        payment.balanceAmount = 0;
        payment.status = 'PAID';
        if (paymentMode) payment.paymentMode = paymentMode;
        if (paymentDate) payment.paymentDate = new Date(paymentDate);

        await payment.save();

        res.json({ message: 'Payment marked as paid successfully', payment });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * PATCH /api/payments/:id/update-mode
 * Access: STAFF, ADMIN
 */
const updatePaymentMode = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentMode } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid Payment ID' });
        }

        const payment = await Payment.findByIdAndUpdate(
            id,
            { paymentMode },
            { new: true }
        );

        if (!payment) {
            return res.status(404).json({ message: 'Payment record not found' });
        }

        res.json({ message: 'Payment mode updated successfully', payment });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/payments/:id
 * Access: STAFF, ADMIN
 */
const getPaymentById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid Payment ID' });
        }

        const payment = await Payment.findById(id).populate({
            path: 'bookingId',
            populate: { path: 'courtId' }
        });

        if (!payment) {
            return res.status(404).json({ message: 'Payment record not found' });
        }

        res.json(payment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getPaymentsList,
    markAsPaid,
    updatePaymentMode,
    getPaymentById
};
