const mongoose = require('mongoose');
const moment = require('moment');

const recurringBookingSchema = new mongoose.Schema({
    customerName: {
        type: String,
        required: true,
        trim: true
    },
    customerPhone: {
        type: String,
        required: true,
        trim: true
    },
    sportType: {
        type: String,
        trim: true
    },
    courtId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Court',
        required: true
    },
    recurrenceType: {
        type: String,
        enum: ['WEEKLY', 'MONTHLY'],
        required: true
    },
    daysOfWeek: [{
        type: String,
        enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
    }],
    fixedDate: {
        type: Number,
        min: 1,
        max: 31
    },
    startTime: {
        type: String, // Format: "HH:mm"
        required: true
    },
    endTime: {
        type: String, // Format: "HH:mm"
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date
    },
    monthlyAmount: {
        type: Number,
        default: 0
    },
    paymentStatus: {
        type: String,
        enum: ['PAID', 'PENDING', 'PARTIAL'],
        default: 'PENDING'
    },
    advancePaid: {
        type: Number,
        default: 0
    },
    discountType: {
        type: String,
        enum: ['NONE', 'FLAT', 'PERCENT'],
        default: 'NONE'
    },
    discountValue: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'PAUSED'],
        default: 'ACTIVE'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Normalize dates to midnight before saving
recurringBookingSchema.pre('save', function (next) {
    if (this.startDate) {
        this.startDate = moment(this.startDate).startOf('day').toDate();
    }
    if (this.endDate) {
        this.endDate = moment(this.endDate).startOf('day').toDate();
    }
    next();
});

module.exports = mongoose.model('RecurringBooking', recurringBookingSchema);
