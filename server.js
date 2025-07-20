// Fix import paths in server.js
const fs = require('fs');


// Updated server.js with correct imports
const express = require('express');

const cors = require('cors');
const helmet = require('helmet');
const https = require("https");
const http = require("http");
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { testConnection, initializeTables } = require('./config/database');

// Import routes with correct paths
const authRoutes = require('./routes/auth');
const tipsRoutes = require('./routes/tips');
const matchesRoutes = require('./routes/matches');
const tipstersRoutes = require('./routes/tipsters');

const app = express();
const expressWs = require("express-ws")(app)
const PORT = process.env.PORT || 443;
const HTTP_PORT = process.env.HTTP_PORT || 80;

// Security middleware


// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// CORS configuration

// CORS configuration - FINAL VERSION

app.use(
  cors({
    origin: ["http://localhost:3001", "https://www.bettingstats-central.app"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "authentication",
      "X-HTTP-Method-Override",
      "Accept",
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);




// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});


// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Betting Tips API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tips', tipsRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/tipsters', tipstersRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON'
    });
  }
  
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Request body too large',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.ws("/new-tip", function (ws, req) {
  ws.on("message", function (msg) {
    console.log(msg);
  });
  console.log("socket", req.testing);
});
/*
const sslOptions = {
  key: fs.readFileSync(`key.pem`),
  cert: fs.readFileSync(`cert.pem`),
};
*/
// Start server
async function startServer() {
  try {
    await testConnection();
    await initializeTables();
    http
      .createServer(app)
      .listen(HTTP_PORT, () =>
        console.log(`HTTP on ${HTTP_PORT} → redirects to HTTPS`)
      );
      
    https.createServer(sslOptions, app).listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`📡 API Health Check: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
      console.log(`📊 Tips endpoints: http://localhost:${PORT}/api/tips`);
      console.log(`⚽ Matches endpoints: http://localhost:${PORT}/api/matches`);
      console.log(
        `👤 Tipsters endpoints: http://localhost:${PORT}/api/tipsters`
      );
    });
    

    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();