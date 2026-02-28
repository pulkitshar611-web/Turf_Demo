const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const RecurringBooking = require('../models/RecurringBooking.model');
const { processRecurringBooking } = require('../services/recurringGenerator.service');

const fixRecurringSlots = async () => {
    try {
        await connectDB();
        console.log('Database connected.');

        const rules = await RecurringBooking.find({ status: 'ACTIVE' });
        console.log(`Found ${rules.length} active recurring rules.`);

        for (const rule of rules) {
            console.log(`Processing rule: ${rule._id} for ${rule.customerName}`);
            const results = await processRecurringBooking(rule._id);
            console.log(`- Success: ${results.success}`);
            console.log(`- Failed: ${results.failed}`);
            if (results.conflicts.length > 0) {
                console.log(`- Conflicts: ${JSON.stringify(results.conflicts)}`);
            }
        }

        console.log('Done.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixRecurringSlots();
