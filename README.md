# Hotel Booking API

Enterprise-grade Hotel Booking API built with TypeScript, Express.js, PostgreSQL, and Redis. This API provides comprehensive hotel booking management with robust security, validation, and performance optimizations.

## 🚀 Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Hotel Management**: Accommodation listings with search and filtering
- **Booking System**: Complete booking lifecycle management
- **Payment Integration**: Support for Stripe, PayPal, and Flutterwave
- **Security**: Enterprise-grade security with rate limiting, CORS, and input validation
- **Database**: PostgreSQL with connection pooling and Redis caching
- **Logging**: Winston-based logging with daily rotation
- **API Documentation**: RESTful API with comprehensive validation

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (>= 18.0.0)
- **npm** (>= 9.0.0)
- **PostgreSQL** (>= 12.0)
- **Redis** (>= 6.0) - for caching and session management
- **pgAdmin** (optional, for database management)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hotel-booking-backend-enterprise
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory with the following variables:

   ```env
   # Server Configuration
   NODE_ENV=development
   PORT=5000

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=hotel_booking_db
   DB_USER=postgres
   DB_PASSWORD=your_postgres_password
   DB_POOL_MAX=50
   DB_POOL_MIN=10
   DB_QUERY_TIMEOUT=30000

   # Redis Configuration
   REDIS_URL=redis://localhost:6379
   REDIS_PASSWORD=your_redis_password

   # JWT Configuration
   JWT_SECRET=your_jwt_secret_key_here
   JWT_EXPIRE=7d
   JWT_REFRESH_SECRET=your_refresh_secret_key_here
   JWT_REFRESH_EXPIRE=30d

   # CORS Configuration
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
   FRONTEND_URL=http://localhost:3000

   # Payment Gateway Keys (Optional - for payment features)
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   PAYPAL_CLIENT_ID=your_paypal_client_id
   PAYPAL_CLIENT_SECRET=your_paypal_client_secret
   FLUTTERWAVE_PUBLIC_KEY=your_flutterwave_public_key
   FLUTTERWAVE_SECRET_KEY=your_flutterwave_secret_key

   # Email Configuration (Optional - for notifications)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password

   # Security Configuration
   BCRYPT_ROUNDS=12
   SESSION_SECRET=your_session_secret_key
   ```

## 🗄️ Database Setup

### Using pgAdmin

1. **Install pgAdmin** from [pgadmin.org](https://www.pgadmin.org/)

2. **Create Database**
   - Open pgAdmin and connect to your PostgreSQL server
   - Right-click on "Databases" → "Create" → "Database"
   - Name: `hotel_booking_db`
   - Owner: `postgres` (or your PostgreSQL username)
   - Click "Save"

3. **Verify Connection**
   - In pgAdmin, expand the database and check if you can see system tables
   - The application will create tables automatically on first run

### Alternative: Command Line

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE hotel_booking_db;

# Exit
\q
```

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```
This starts the server with hot reloading using nodemon.

### Production Mode
```bash
npm run build
npm run start:prod
```

### Alternative Commands
```bash
# Start with TypeScript directly
npm run start:dev

# Build only
npm run build

# Start built version
npm start
```

The server will start on `http://localhost:5000` (or your configured PORT).

## 📡 API Endpoints

### Base URL
```
http://localhost:5000/api
```

### Health Check
- **GET** `/health` - Basic health check
- **GET** `/api/health` - Detailed health check with database status

### Authentication Endpoints

#### Register User
- **POST** `/api/auth/register`
- **Content-Type**: `application/json`

**Request Body:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "SecurePass123",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "phone": "+1234567890",
      "role": "user"
    },
    "accessToken": "jwt_token_here",
    "refreshToken": "refresh_token_here"
  }
}
```

#### Login User
- **POST** `/api/auth/login`
- **Content-Type**: `application/json`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

#### Get Current User
- **GET** `/api/auth/me`
- **Authorization**: `Bearer <access_token>`

#### Logout
- **POST** `/api/auth/logout`
- **Authorization**: `Bearer <access_token>`

### Accommodation Endpoints
*Note: These endpoints are currently not implemented (return 501)*

- **GET** `/api/accommodations` - List accommodations
- **GET** `/api/accommodations/:id` - Get accommodation details

**Example Search Query:**
```
GET /api/accommodations?city=New%20York&checkin_date=2024-01-15&checkout_date=2024-01-20&guest_count=2&min_price=100&max_price=500&star_rating=4
```

### Booking Endpoints
*Note: These endpoints are currently not implemented (return 501)*

- **POST** `/api/bookings` - Create booking
- **GET** `/api/bookings/:id` - Get booking details

**Example Booking Request:**
```json
{
  "accommodation_id": "uuid-of-accommodation",
  "room_type_id": "uuid-of-room-type",
  "checkin_date": "2024-01-15",
  "checkout_date": "2024-01-20",
  "guest_count": 2
}
```

### Payment Endpoints
*Note: These endpoints are currently not implemented (return 501)*

- **POST** `/api/payments/intent` - Create payment intent
- **POST** `/api/payments/webhook` - Handle payment webhooks

**Example Payment Request:**
```json
{
  "booking_id": "uuid-of-booking",
  "amount": 299.99,
  "payment_method": "card"
}
```

### User Endpoints
*Note: These endpoints are currently not implemented (return 501)*

- **GET** `/api/users/me` - Get current user profile

### Admin Endpoints
*Note: These endpoints are currently not implemented (return 501)*

- **GET** `/api/admin` - Admin dashboard data

## 🧪 Testing the API

### Using cURL

#### Test Health Check
```bash
curl http://localhost:5000/health
```

#### Register a User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "TestPass123",
    "phone": "+1234567890"
  }'
```

#### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

#### Get Current User (replace TOKEN with actual token)
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

### Using Postman

1. **Import API Collection** (create manually or use the endpoints above)
2. **Set Base URL**: `http://localhost:5000/api`
3. **Set Authorization**: For protected routes, use Bearer Token

### Testing with Sample Data

#### Accommodation Search Example
```bash
curl "http://localhost:5000/api/accommodations?city=Paris&checkin_date=2024-02-01&checkout_date=2024-02-05&guest_count=2"
```

#### Booking Creation Example
```bash
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "accommodation_id": "550e8400-e29b-41d4-a716-446655440000",
    "room_type_id": "550e8400-e29b-41d4-a716-446655440001",
    "checkin_date": "2024-02-01",
    "checkout_date": "2024-02-05",
    "guest_count": 2
  }'
```

## 🔧 Development Scripts

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm run start:prod

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Database migration (if implemented)
npm run migrate

# Seed database (if implemented)
npm run seed
```

## 📁 Project Structure

```
hotel-booking-backend-enterprise/
├── src/
│   ├── app.ts                 # Main application setup
│   ├── config/
│   │   ├── database.ts        # PostgreSQL configuration
│   │   └── logger.ts          # Winston logger configuration
│   ├── controllers/           # Route controllers
│   ├── middleware/            # Express middleware
│   ├── routes/               # API routes
│   ├── services/             # Business logic services
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Utility functions
├── types/                    # Custom type definitions
├── logs/                     # Application logs
├── dist/                     # Compiled JavaScript (after build)
├── package.json
├── tsconfig.json
├── .env                      # Environment variables (create this)
└── README.md
```

## 🔒 Security Features

- **Rate Limiting**: API rate limiting with Redis
- **CORS**: Configurable cross-origin resource sharing
- **Helmet**: Security headers
- **Input Validation**: Comprehensive input sanitization and validation
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Input sanitization
- **CSRF Protection**: CSRF tokens for sensitive operations

## 📊 Monitoring & Logging

- **Winston Logger**: Structured logging with daily rotation
- **Morgan**: HTTP request logging
- **Health Checks**: Application and database health monitoring
- **Error Handling**: Centralized error handling with proper HTTP status codes

## 🚀 Deployment

### Docker Deployment
```bash
# Build Docker image
npm run docker:build

# Run with Docker Compose
npm run docker:up

# Stop containers
npm run docker:down
```

### Environment Variables for Production
- Set `NODE_ENV=production`
- Configure production database credentials
- Set secure JWT secrets
- Configure payment gateway keys
- Set up proper CORS origins

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and tests
6. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support, please contact the development team or create an issue in the repository.

---

**Note**: Most API endpoints are currently stubbed and return "501 Not Implemented". The authentication system is fully functional. Additional features will be implemented in future updates.
