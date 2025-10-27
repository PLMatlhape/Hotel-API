import express, { Application, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import RedisStore from 'connect-redis';

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`
🚀 Server running in ${process.env.NODE_ENV || 'development'} mode
📡 Port: ${PORT}
🔗 Base URL: http://localhost:${PORT}
📚 API Docs: http://localhost:${PORT}/api
🏥 Health Check: http://localhost:${PORT}/health
      `);
    });

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
  logger.error('❌ UNCAUGHT EXCEPTION! Shutting down...', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
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
startServer();

export default app;