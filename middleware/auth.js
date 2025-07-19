const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    // Get token from cookie
    const token = req.headers.authentication;
    console.log(token)
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No authentication token provided',
        code: 'AUTH_TOKEN_MISSING'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded)
    // Check if session exists in database
    const [sessions] = await pool.execute(
      "SELECT s.*, u.username, u.email, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.session_token = ? AND s.expires_at > NOW()",
      [decoded]
    );
    console.log(sessions)

    /*if (sessions.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session',
        code: 'SESSION_INVALID'
      });
    }*/

    // Attach user info to request
    req.user = {
      id: decoded.user_id,
      username: decoded.username,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies.auth_session;
    
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const [sessions] = await pool.execute(
      'SELECT s.*, u.username, u.email, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.session_token = ? AND s.expires_at > NOW()',
      [token]
    );

    if (sessions.length > 0) {
      req.user = {
        id: sessions[0].user_id,
        username: sessions[0].username,
        email: sessions[0].email,
        role: sessions[0].role
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

// Admin role middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }
  next();
};

// Clean expired sessions
const cleanExpiredSessions = async () => {
  try {
    await pool.execute('DELETE FROM sessions WHERE expires_at < NOW()');
  } catch (error) {
    console.error('Error cleaning expired sessions:', error);
  }
};

// Run cleanup every hour
setInterval(cleanExpiredSessions, 60 * 60 * 1000);

module.exports = {
  authenticate,
  optionalAuth,
  requireAdmin,
  cleanExpiredSessions
};