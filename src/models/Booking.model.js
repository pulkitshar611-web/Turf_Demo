const mongoose = require('mongoose');
const moment = require('moment');

const bookingSchema = new mongoose.Schema({
    customerName: {
        type: String,
        required: true,
        trim: true,
    },
    customerPhone: {
        type: String,
        required: true,
        trim: true,
    },
    sportType: {
        type: String,
        required: true,
    },
    courtId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Court',
        required: true,
    },
    bookingDate: {
        type: Date,
        required: true,
    },
    startTime: {
        type: String,
        required: true,
    },
    endTime: {
        type: String,
        required: true,
    },
    totalSlots: {
        type: Number,
        required: true,
    },
    baseAmount: {
        type: Number,
        required: true,
    },
    discountType: {
        type: String,
        enum: ['PERCENT', 'FLAT', 'NONE'],
        default: 'NONE',
    },
    discountValue: {
        type: Number,
        default: 0,
    },
    finalAmount: {
        type: Number,
        required: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['BOOKED', 'CANCELLED', 'COMPLETED'],
        default: 'BOOKED',
    },
    source: {
        type: String,
        enum: ['MANUAL', 'RECURRING'],
        default: 'MANUAL',
    },
    recurringId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RecurringBooking',
        required: false,
        default: null
    }
}, { timestamps: true });

// Normalize date to midnight before saving
bookingSchema.pre('save', function (next) {
    if (this.bookingDate) {
        this.bookingDate = moment(this.bookingDate).startOf('day').toDate();
    }
    next();
});

module.exports = mongoose.model('Booking', bookingSchema);
