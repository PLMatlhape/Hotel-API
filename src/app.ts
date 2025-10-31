import express, { Application, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import RedisStore from 'connect-redis';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Import database
import { testConnection, closePool } from './config/database.js';

// Import logger
import logger, { stream } from './utils/logger.js';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import {
  securityHeaders,
  apiLimiter,
  speedLimiter,
  sanitizeInput,
  preventParamPollution,
  requestId,
  ipFilter,
  validateContentType,
  requestSizeLimiter,
  securityLogger as securityLoggerMiddleware,
} from './middleware/security.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import oauthRoutes from './routes/oauth.routes.js';
import accommodationRoutes from './routes/accommodation.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';

// =============================================
// CREATE EXPRESS APP
// =============================================
const app: Application = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for load balancers
app.set('trust proxy', 1);

// =============================================
// MIDDLEWARE - SECURITY & PARSING
// =============================================

// Request ID for tracing
app.use(requestId);

// Security headers
app.use(securityHeaders);

// IP filtering
app.use(ipFilter);

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '').split(',');
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token'],
};

app.use(cors(corsOptions));

// Cookie parser
app.use(cookieParser());

// Request size limiter
app.use(requestSizeLimiter);

// Body parser middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Input sanitization
app.use(sanitizeInput);

// Parameter pollution protection
app.use(preventParamPollution);

// Compression
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024,
}));

// HTTP request logging
app.use(morgan('combined', { stream }));

// Rate limiting
app.use('/api/', apiLimiter);

// Speed limiting for suspicious activity
app.use('/api/', speedLimiter);

// Content type validation
app.use('/api/', validateContentType);

// Security logging
app.use('/api/', securityLoggerMiddleware);

// =============================================
// STATIC FILES - Serve uploaded images
// =============================================
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// =============================================
// HEALTH CHECK ENDPOINTS
// =============================================
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const dbStatus = await testConnection();
    
    res.status(200).json({
      status: 'healthy',
      services: {
        database: dbStatus ? 'connected' : 'disconnected',
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Service unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

// =============================================
// API ROUTES
// =============================================
app.use('/api/auth', authRoutes);
// Backwards-compatible aliases (some clients use /api/login or /api/register)
import * as authController from './controllers/auth.controller.js';
import { validate } from './middleware/validation.js';
import { registerValidator, loginValidator, createAccommodationValidator } from './utils/validators.js';
import { protect, restrictTo } from './middleware/auth.js';
import { createAccommodation } from './controllers/accommodation.controller.js';
import { URL } from 'url';

// Normalize incoming URLs: decode percent-encoding, trim whitespace in the pathname,
// then re-encode. This handles requests like `/api/me%20` (encoded trailing space)
// while being defensive about malformed encoding.
app.use((req, _res, next) => {
  try {
    const parsed = new URL(req.url, 'http://localhost');

    // Try to decode the pathname to expose any real whitespace characters
    let decodedPathname = parsed.pathname;
    try {
      decodedPathname = decodeURIComponent(parsed.pathname);
    } catch (e) {
      // If decode fails (malformed percent-encoding), fall back to raw pathname
      decodedPathname = parsed.pathname;
    }

    const trimmed = decodedPathname.trim();
    if (trimmed !== decodedPathname) {
      // re-encode the trimmed path and preserve search/query
      req.url = encodeURI(trimmed) + parsed.search;
    }
  } catch (e) {
    // ignore and continue — do not block request on normalization errors
  }

  next();
});

app.post('/api/login', loginValidator, validate, authController.login);
app.post('/api/register', registerValidator, validate, authController.register);

// Alias for getting current user at /api/me (some clients expect this)
app.get('/api/me', protect, authController.getCurrentUser);
// Alias for logout at /api/logout
app.post('/api/logout', protect, authController.logout);
// Backwards-compatible alias for singular accommodation path
app.post('/api/accommodation', protect, restrictTo('admin'), createAccommodationValidator, validate, createAccommodation);
app.use('/api/oauth', oauthRoutes);
app.use('/api/accommodations', accommodationRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// =============================================
// API INFO ENDPOINT
// =============================================
app.get('/api', (req: Request, res: Response) => {
  res.json({
    name: 'Hotel Booking API',
    version: '1.0.0',
    description: 'Enterprise-grade hotel booking management system',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      accommodations: '/api/accommodations',
      bookings: '/api/bookings',
      payments: '/api/payments',
      users: '/api/users',
      admin: '/api/admin',
    },
  });
});

// =============================================
// ERROR HANDLING
// =============================================
app.use(notFoundHandler);
app.use(errorHandler);

// =============================================
// SERVER STARTUP
// =============================================
const startServer = async () => {
  // Helper to attempt listening on a port and wait for success/error
  const listenOnPort = (port: number) => new Promise<any>((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.on('error', (err: any) => reject(err));
  });

  try {
    console.log('🔄 Starting server...');
    console.log('📊 Testing database connection...');
    
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Database connection failed!');
      throw new Error('Database connection failed');
    }
    
    console.log('✅ Database connected successfully!');

    // Attempt to start server on configured port, falling back if port is in use
    let port = Number(process.env.PORT) || Number(PORT) || 5000;
    const maxAttempts = 5;
    let attempt = 0;
    let server: any = null;

    while (attempt < maxAttempts) {
      try {
        server = await listenOnPort(port);
        console.log(`✅ Server listening on port ${port}`);
        logger.info(`Server listening on port ${port}`);
        break;
      } catch (err: any) {
        if (err && err.code === 'EADDRINUSE') {
          logger.warn(`Port ${port} is in use, trying next port...`);
          port += 1;
          attempt += 1;
          continue;
        }
        throw err;
      }
    }

    if (!server) {
      throw new Error(`Unable to bind to a port after ${maxAttempts} attempts`);
    }

    // Log useful info using the final port
    const serverInfo = `
🚀 Server running in ${process.env.NODE_ENV || 'development'} mode
📡 Port: ${port}
🔗 Base URL: http://localhost:${port}
📚 API Docs: http://localhost:${port}/api
🏥 Health Check: http://localhost:${port}/health
🔗 Database: ${process.env.DB_NAME || 'Not configured'}
    `;
    
    console.log(serverInfo);
    logger.info(serverInfo);

    // Server timeout configuration
    server.timeout = 30000; // 30 seconds
    server.keepAliveTimeout = 65000; // 65 seconds
    server.headersTimeout = 66000; // 66 seconds

    return server;
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// =============================================
// GRACEFUL SHUTDOWN
// =============================================
const gracefulShutdown = async (signal: string) => {
  logger.info(`\n${signal} received. Shutting down gracefully...`);

  const shutdownTimeout = setTimeout(() => {
    logger.error('❌ Shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, 30000); // 30 second timeout

  try {
    // Close database connections
    await closePool();
    logger.info('✅ Database connections closed');

    clearTimeout(shutdownTimeout);
    logger.info('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  logger.error('❌ UNCAUGHT EXCEPTION! Shutting down...', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
  logger.error('❌ UNHANDLED REJECTION! Shutting down...', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  process.exit(1);
});

// Handle warnings
process.on('warning', (warning) => {
  logger.warn('⚠️ Process Warning:', {
    name: warning.name,
    message: warning.message,
    stack: warning.stack,
  });
});

// Start the server
(async () => {
  console.log('🚀 Application starting...');
  console.log('📁 Working directory:', process.cwd());
  console.log('🔧 Node version:', process.version);
  console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
  
  try {
    await startServer();
  } catch (error) {
    console.error('❌ Fatal error during startup:', error);
    logger.error('Fatal startup error:', error);
    process.exit(1);
  }
})();

export default app;