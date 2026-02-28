const mongoose = require('mongoose');

const courtSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a court name'],
        trim: true,
    },
    sportType: {
        type: String,
        required: [true, 'Please select a sport type'],
        enum: ['Football', 'Cricket', 'Badminton', 'Pickleball'],
    },
    weekdayPrice: {
        type: Number,
        required: [true, 'Please add weekday price'],
        min: 0,
    },
    weekendPrice: {
        type: Number,
        required: [true, 'Please add weekend price'],
        min: 0,
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'INACTIVE'],
        default: 'ACTIVE',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Prevent duplicate court names for the same sport type
courtSchema.index({ name: 1, sportType: 1 }, { unique: true });

module.exports = mongoose.model('Court', courtSchema);
