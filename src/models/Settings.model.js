const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    turfName: {
        type: String,
        required: [true, 'Turf name is required'],
        trim: true
    },
    openingTime: {
        type: String,
        required: [true, 'Opening time is required'],
        match: [/^([01]\d|2[0-3]):?([0-5]\d)$/, 'Please provide a valid time in HH:mm format']
    },
    closingTime: {
        type: String,
        required: [true, 'Closing time is required'],
        match: [/^([01]\d|2[0-3]):?([0-5]\d)$/, 'Please provide a valid time in HH:mm format']
    },
    slotDuration: {
        type: Number,
        default: 15, // Fixed at 15 minutes as per requirements
        immutable: true
    },
    weekendDays: {
        type: [String],
        default: ['SAT', 'SUN'],
        validate: {
            validator: function (v) {
                return v.length > 0;
            },
            message: 'At least one weekend day is required'
        }
    },
    currency: {
        type: String,
        default: 'INR'
    }
}, {
    timestamps: true
});

// Enforce singleton: only one settings document allowed
settingsSchema.statics.getSettings = async function () {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({
            turfName: 'Pro Sports Turf',
            openingTime: '06:00',
            closingTime: '23:00',
            weekendDays: ['SAT', 'SUN'],
            currency: 'INR'
        });
    }
    return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
