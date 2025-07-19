const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const {
  login,
  logout,
  status,
  register,
  loginValidation,
  registerValidation
} = require('../controllers/auth');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to login and register
router.use(['/login', '/register'], authLimiter);

/**
 * @route POST /api/auth/login
 * @desc Login user and set authentication cookie
 * @access Public
 */
router.post('/login', loginValidation, login);

/**
 * @route POST /api/auth/logout
 * @desc Logout user and clear authentication cookie
 * @access Public
 */
router.post('/logout', logout);

/**
 * @route GET /api/auth/status
 * @desc Check authentication status
 * @access Public
 */
router.get('/status', status);

/**
 * @route POST /api/auth/register
 * @desc Register new user (admin only)
 * @access Private (Admin)
 */
router.post('/register', authenticate, registerValidation, register);

module.exports = router;