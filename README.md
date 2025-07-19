# Betting Tips REST API

A comprehensive Node.js REST API for managing betting tips, matches, and tipster data with secure cookie-based authentication and MySQL database integration.

## Features

- 🔐 **Secure Authentication**: Cookie-based authentication with JWT tokens
- 📊 **Comprehensive Data Management**: Tips, matches, and tipsters with detailed statistics
- 🛡️ **Security**: Rate limiting, CORS protection, input validation
- 📱 **Mobile-First**: Designed for responsive web applications
- 🗄️ **MySQL Database**: Robust relational database with proper indexing
- 🔍 **Advanced Filtering**: Search and filter data with pagination
- 📈 **Performance Tracking**: Detailed tipster performance analytics

## Prerequisites

- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- npm or yarn package manager

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd betting-tips-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=betting_tips
   DB_PORT=3306

   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
   JWT_EXPIRES_IN=24h

   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # CORS Configuration
   FRONTEND_URL=http://localhost:8080
   ```

4. **Set up MySQL database**
   ```sql
   CREATE DATABASE betting_tips;
   CREATE USER 'api_user'@'localhost' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON betting_tips.* TO 'api_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

5. **Start the server**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

6. **Seed the database (optional)**
   ```bash
   node seed-database.js
   ```

## API Endpoints

### Authentication

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/auth/login` | Login user | Public |
| POST | `/api/auth/logout` | Logout user | Public |
| GET | `/api/auth/status` | Check auth status | Public |
| POST | `/api/auth/register` | Register user | Admin |

### Tips

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/tips` | Get all tips | Public |
| GET | `/api/tips/:id` | Get tip by ID | Public |
| POST | `/api/tips` | Create tip | Admin |
| PUT | `/api/tips/:id` | Update tip | Admin |
| DELETE | `/api/tips/:id` | Delete tip | Admin |

### Matches

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/matches` | Get all matches | Public |
| GET | `/api/matches/:id` | Get match by ID | Public |
| POST | `/api/matches` | Create match | Admin |
| PUT | `/api/matches/:id` | Update match | Admin |
| DELETE | `/api/matches/:id` | Delete match | Admin |

### Tipsters

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/tipsters` | Get all tipsters | Public |
| GET | `/api/tipsters/:id` | Get tipster by ID | Public |
| GET | `/api/tipsters/:id/stats` | Get tipster stats | Public |
| POST | `/api/tipsters` | Create tipster | Admin |
| PUT | `/api/tipsters/:id` | Update tipster | Admin |
| DELETE | `/api/tipsters/:id` | Delete tipster | Admin |

## Query Parameters

### Filtering & Pagination

Most GET endpoints support these query parameters:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sortBy`: Field to sort by
- `sortOrder`: 'ASC' or 'DESC' (default: 'DESC')

### Tips Filtering

- `status`: pending, won, lost, void
- `sport`: football, basketball, etc.
- `competition`: Competition name (partial match)
- `tipster`: Tipster ID

### Matches Filtering

- `date`: Match date (YYYY-MM-DD)
- `competition`: Competition name (partial match)
- `team`: Team name (partial match)
- `status`: Match status
- `sport`: Sport type

### Tipsters Filtering

- `platform`: Platform name (blogabet, etc.)
- `type`: Tipster type (algorithm, human, etc.)

## Usage Examples

### Authentication

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' \
  -c cookies.txt

# Check status
curl -X GET http://localhost:3000/api/auth/status \
  -b cookies.txt

# Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt
```

### Getting Tips

```bash
# Get all tips
curl -X GET "http://localhost:3000/api/tips?page=1&limit=10&status=pending"

# Get specific tip
curl -X GET "http://localhost:3000/api/tips/686cbc614fc6c8c4a36fc65e"

# Get tips by sport
curl -X GET "http://localhost:3000/api/tips?sport=football&competition=premier%20league"
```

### Getting Matches

```bash
# Get today's matches
curl -X GET "http://localhost:3000/api/matches?date=2025-07-18"

# Get match with statistics
curl -X GET "http://localhost:3000/api/matches/6871f4c9d548af101c076ca7"
```

### Getting Tipsters

```bash
# Get all tipsters
curl -X GET "http://localhost:3000/api/tipsters"

# Get tipster performance
curl -X GET "http://localhost:3000/api/tipsters/687181e7d548af101c075f3a"

# Get tipster statistics
curl -X GET "http://localhost:3000/api/tipsters/687181e7d548af101c075f3a/stats"
```

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalItems": 200,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Database Schema

### Users Table
- `id`: Primary key
- `username`: Unique username
- `password_hash`: Hashed password
- `email`: User email
- `role`: 'user' or 'admin'
- `created_at`, `updated_at`: Timestamps

### Tips Table
- `id`: Primary key
- `home_team`, `away_team`: Team names
- `selection`: Betting selection
- `market_type`: Type of market
- `odds`: Betting odds
- `stake`: Stake amount
- `status`: 'pending', 'won', 'lost', 'void'
- `sport`: Sport type
- `competition`: Competition name
- `match_id`: Reference to matches
- `tipster_id`: Reference to tipsters
- `event_starttime`: Match start time
- `result_data`: JSON result data

### Matches Table
- `id`: Primary key
- `home_team_id`, `away_team_id`: Team IDs
- `home_team_name`, `away_team_name`: Team names
- `match_date`, `match_time`: Match timing
- `sport`: Sport type
- `competition_name`: Competition name
- `odds_data`: JSON odds data
- `statistics`: JSON match statistics

### Tipsters Table
- `id`: Primary key
- `name`: Tipster name
- `url`: Tipster URL
- `type`: Tipster type
- `platform`: Platform name
- `tracked_data`: JSON performance data

## Security Features

- **Rate Limiting**: 1000 requests per 15 minutes per IP
- **Authentication Rate Limiting**: 5 login attempts per 15 minutes
- **CORS Protection**: Configured for specific origins
- **Input Validation**: All inputs are validated
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Helmet.js security headers
- **Secure Cookies**: HTTP-only, secure, SameSite cookies

## Development

### File Structure
```
betting-tips-api/
├── config/
│   └── database.js          # Database configuration
├── controllers/
│   ├── auth.js              # Authentication logic
│   ├── tips.js              # Tips management
│   ├── matches.js           # Matches management
│   └── tipsters.js          # Tipsters management
├── middleware/
│   └── auth.js              # Authentication middleware
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── tips.js              # Tips routes
│   ├── matches.js           # Matches routes
│   └── tipsters.js          # Tipsters routes
├── server.js                # Main server file
├── seed-database.js         # Database seeding
├── package.json
└── .env                     # Environment variables
```

### Running Tests

```bash
npm test
```

### Development Mode

```bash
npm run dev
```

This starts the server with nodemon for automatic restarts on file changes.

## Default Credentials

After running the database setup, a default admin user is created:
- **Username**: `admin`
- **Password**: `admin123`

**Important**: Change these credentials in production!

## Production Deployment

1. Set `NODE_ENV=production` in your environment
2. Use a strong JWT secret
3. Configure proper database credentials
4. Enable HTTPS
5. Set up proper monitoring and logging
6. Configure database backups

## Support

For questions or issues, please refer to the documentation or contact the development team.

## License

This project is licensed under the MIT License.