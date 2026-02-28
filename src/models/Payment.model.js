const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
    },
    totalAmount: {
        type: Number,
        required: true,
    },
    advancePaid: {
        type: Number,
        required: true,
    },
    balanceAmount: {
        type: Number,
        required: true,
    },
    paymentMode: {
        type: String,
        enum: ['CASH', 'UPI', 'CARD', 'ONLINE'],
        required: true,
    },
    paymentNotes: {
        type: String,
        trim: true,
    },
    status: {
        type: String,
        enum: ['PARTIAL', 'PAID', 'PENDING'],
        default: 'PARTIAL',
    },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
