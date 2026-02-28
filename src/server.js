require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { initBookingCron } = require('./services/cron.service');

const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Initialize Cron Jobs
    initBookingCron();
});
