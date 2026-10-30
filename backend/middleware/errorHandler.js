const errorHandler = (err, req, res, next) => {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: `Resource not found with ID of ${err.value}`
        });
    }

    // Mongoose duplicate key error (code 11000)
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        const val = err.keyValue ? err.keyValue[field] : '';
        return res.status(400).json({
            success: false,
            message: `A record with ${field} '${val}' already exists.`
        });
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(val => val.message);
        return res.status(400).json({
            success: false,
            message: messages.join(', '),
            errors: messages
        });
    }

    const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
    return res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

const notFound = (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({
            success: false,
            message: `API endpoint not found: ${req.method} ${req.originalUrl}`
        });
    }
    // For non-API routes, let Express static or fallback serve
    res.status(404).send('Page not found');
};

module.exports = { errorHandler, notFound };
