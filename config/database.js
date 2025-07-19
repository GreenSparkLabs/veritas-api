const mysql = require('mysql2/promise');
require('dotenv').config();

// Create MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'betting_tips',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// Test the connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

// Initialize database tables
async function initializeTables() {
  try {
    const connection = await pool.getConnection();
    
    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        role ENUM('user', 'admin') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create sessions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    

    // Create default admin user if not exists
    const [existingUsers] = await connection.execute(
      'SELECT COUNT(*) as count FROM users WHERE role = "admin"'
    );
    
    if (existingUsers[0].count === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      await connection.execute(
        'INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)',
        ['admin', hashedPassword, 'admin@example.com', 'admin']
      );
      
      console.log('✅ Default admin user created (username: admin, password: admin123)');
    }

    connection.release();
    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
}

module.exports = {
  pool,
  testConnection,
  initializeTables
};