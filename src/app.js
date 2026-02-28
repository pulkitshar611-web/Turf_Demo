const express = require('express');
const cors = require('cors');
const routes = require('./routes'); // Import main routes
// const { notFound, errorHandler } = require('./middlewares'); // Import error middlewares

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use('/api', routes);

// Error Handling
app.use((req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
});

app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

module.exports = app;
