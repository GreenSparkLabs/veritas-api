const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');

// Login controller
const login = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, password } = req.body;
    
    // Find user
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    console.log(users)

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'AUTH_FAILED'
      });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log(user.password_hash);
    console.log(password);
    console.log(isValidPassword);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'AUTH_FAILED'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Calculate expiry time
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 24);

    // Store session in database
    await pool.execute(
      'INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiryDate]
    );

    // Update last login
    await pool.execute(
      'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    // Set cookie
    res.cookie('auth_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        lastLogin: new Date().toISOString()
      },
      token: token,
      sessionExpiry: expiryDate.toISOString()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Logout controller
const logout = async (req, res) => {
  try {
    const token = req.cookies.auth_session;
    
    if (token) {
      // Remove session from database
      await pool.execute(
        'DELETE FROM sessions WHERE session_token = ?',
        [token]
      );
    }

    // Clear cookie
    res.clearCookie('auth_session');

    res.json({
      success: true,
      message: 'Successfully logged out'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Status controller
const status = async (req, res) => {
  try {
    const token = req.cookies.auth_session;
    
    if (!token) {
      return res.json({
        authenticated: false
      });
    }

    // Verify token and get user info
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const [sessions] = await pool.execute(
      'SELECT s.*, u.username, u.email, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.session_token = ? AND s.expires_at > NOW()',
      [token]
    );

    if (sessions.length === 0) {
      return res.json({
        authenticated: false
      });
    }

    const session = sessions[0];

    res.json({
      authenticated: true,
      user: {
        id: session.user_id,
        username: session.username,
        email: session.email,
        role: session.role,
        sessionExpiry: session.expires_at
      }
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.json({
        authenticated: false
      });
    }

    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Register controller (for admin use)
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, password, email, role = 'user' } = req.body;

    // Check if user already exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Username or email already exists',
        code: 'USER_EXISTS'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const [result] = await pool.execute(
      'INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, email, role]
    );

    res.status(201).json({
      success: true,
      user: {
        id: result.insertId,
        username,
        email,
        role
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Validation rules
const loginValidation = [
  body('username').trim().isLength({ min: 1 }).withMessage('Username is required'),
  body('password').isLength({ min: 1 }).withMessage('Password is required')
];

const registerValidation = [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['user', 'admin']).withMessage('Role must be user or admin')
];

module.exports = {
  login,
  logout,
  status,
  register,
  loginValidation,
  registerValidation
};