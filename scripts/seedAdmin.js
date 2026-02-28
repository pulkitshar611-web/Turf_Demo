const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../src/models/User.model');
const connectDB = require('../src/config/db');

dotenv.config();

const seedAdmin = async () => {
    try {
        await connectDB();

        const adminExists = await User.findOne({ email: 'admin@test.com' });

        if (adminExists) {
            console.log('Admin user already exists');
            process.exit();
        }

        const user = await User.create({
            name: 'Super Admin',
            email: 'admin@test.com',
            password: 'password123', // Will be hashed by pre-save hook
            role: 'ADMIN',
            status: 'ACTIVE',
        });

        console.log(`Admin user created: ${user.email} / password123`);
        process.exit();
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

seedAdmin();
