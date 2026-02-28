const mongoose = require('mongoose');
const moment = require('moment');

const bookingSlotSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
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
    slotTime: {
        type: String, // e.g. "06:00", "06:15"
        required: true,
    },
    status: {
        type: String,
        enum: ['BOOKED', 'COMPLETED', 'CANCELLED'],
        default: 'BOOKED'
    }
}, { timestamps: true });

// Normalize date to midnight before saving
bookingSlotSchema.pre('save', function (next) {
    if (this.bookingDate) {
        this.bookingDate = moment(this.bookingDate).startOf('day').toDate();
    }
    next();
});

// Prevent double booking: A slot can only exist once in 'BOOKED' state for a specific court and date
// This index allows re-booking once previous booking is 'CANCELLED' or 'COMPLETED'
bookingSlotSchema.index(
    { courtId: 1, bookingDate: 1, slotTime: 1 },
    {
        unique: true,
        partialFilterExpression: { status: 'BOOKED' }
    }
);

module.exports = mongoose.model('BookingSlot', bookingSlotSchema);
