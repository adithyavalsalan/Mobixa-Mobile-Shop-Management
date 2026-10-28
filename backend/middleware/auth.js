const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('JWT_SECRET must be configured with at least 32 characters.');
    }
    return secret;
};

const authenticate = async (req, res, next) => {
    try {
        let token = null;

        // Check HTTP-only cookie
        if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }
        // Check Authorization header
        else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in.'
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, getJwtSecret());
        } catch (jwtErr) {
            return res.status(401).json({
                success: false,
                message: 'Session expired or invalid token. Please log in again.'
            });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User no longer exists.'
            });
        }

        if (user.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'Your account is inactive. Please contact the administrator.'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('[Auth Middleware] Error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Internal authentication error.'
        });
    }
};

const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Administrator privileges required.'
        });
    }
    next();
};

const requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: `Access denied. Requires one of: ${roles.join(', ')}`
        });
    }
    next();
};

const signToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            role: user.role,
            name: user.name
        },
        getJwtSecret(),
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

module.exports = {
    authenticate,
    requireAdmin,
    requireRole,
    signToken
};
