const User = require('../models/User');
const { signToken } = require('../middleware/auth');

// @desc    Login user (Admin or Employee)
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
    try {
        const { email, username, usernameOrEmail, password, role } = req.body;
        const identifier = (email || username || usernameOrEmail || '').trim().toLowerCase();

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email/Username and password are required.'
            });
        }

        // Find user by email or username
        const user = await User.findOne({
            $or: [{ email: identifier }, { username: identifier }]
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials. User not found.'
            });
        }

        if (user.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated. Contact store administrator.'
            });
        }

        // Check password using bcrypt
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password. Please check your credentials.'
            });
        }

        // If client specified a role, verify it matches
        if (role && user.role !== role.toLowerCase()) {
            return res.status(401).json({
                success: false,
                message: `Account is not registered as ${role}. Please select the correct login role.`
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save({ validateBeforeSave: false });

        const token = signToken(user);

        // Set secure HTTP-only cookie
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        };

        res.cookie('token', token, cookieOptions);

        return res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                username: user.username,
                role: user.role,
                phone: user.phone,
                designation: user.designation
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Logout user & clear cookie
// @route   POST /api/auth/logout
// @access  Public
const logout = async (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    });
    return res.json({
        success: true,
        message: 'Logged out successfully'
    });
};

// @desc    Get currently authenticated user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    return res.json({
        success: true,
        user: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            username: req.user.username,
            role: req.user.role,
            phone: req.user.phone,
            designation: req.user.designation,
            joiningDate: req.user.joiningDate,
            salary: req.user.salary,
            status: req.user.status,
            createdAt: req.user.createdAt
        }
    });
};

// @desc    Update current user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
    try {
        const { name, phone } = req.body;
        const user = await User.findById(req.user._id);

        if (name) user.name = name.trim();
        if (phone !== undefined) user.phone = phone.trim();

        await user.save();

        return res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                username: user.username,
                role: user.role,
                phone: user.phone,
                designation: user.designation
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Both current password and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long'
            });
        }

        const user = await User.findById(req.user._id);
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        user.password = newPassword;
        await user.save();

        return res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    login,
    logout,
    getMe,
    updateProfile,
    changePassword
};
