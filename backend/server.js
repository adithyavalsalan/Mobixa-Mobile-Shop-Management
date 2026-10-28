const path = require('path');
const fs = require('fs');

// Auto-create .env from .env.example if missing
const envPath = path.join(__dirname, '../.env');
const envExamplePath = path.join(__dirname, '../.env.example');
if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    try {
        fs.copyFileSync(envExamplePath, envPath);
        console.log('[Mobixa] Auto-generated .env from .env.example');
    } catch (e) {
        // Continue if unable to write
    }
}
require('dotenv').config({ path: envPath });

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { connectDB, getStatus: getDbStatus } = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { signToken } = require('./middleware/auth');

// Route imports
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const saleRoutes = require('./routes/saleRoutes');
const customerRoutes = require('./routes/customerRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // Allow inline scripts and styles used in standard frontend files
}));

// CORS configuration
app.use(cors({
    origin: true,
    credentials: true
}));

// Body & Cookie parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Rate limiting on sensitive auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: 'Too many login attempts from this IP, please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/auth/login', authLimiter);

// Static frontend file serving
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Health check endpoint
app.get('/api/health', (req, res) => {
    const dbStatus = getDbStatus();
    res.json({
        success: true,
        status: 'UP',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbStatus,
        environment: process.env.NODE_ENV || 'development'
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

// Root route - redirect to /login.html
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'login.html'));
});

// 404 & Centralized Error Handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Connect to DB and start listening only if executed directly
if (require.main === module) {
    try {
        signToken({ _id: 'configuration-check' });
        connectDB().then(() => {
            app.listen(PORT, () => {
                console.log(`[Mobixa] Server running at http://localhost:${PORT}`);
                console.log(`[Mobixa] Serving static frontend from: ${frontendPath}`);
            });
        });
    } catch (error) {
        console.error(`[Mobixa] Configuration error: ${error.message}`);
        process.exitCode = 1;
    }
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
    console.log('\n[Mobixa] Gracefully shutting down...');
    process.exit(0);
});

module.exports = app;
