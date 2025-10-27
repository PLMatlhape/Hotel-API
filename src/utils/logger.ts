import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define level colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Determine log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : process.env.LOG_LEVEL || 'info';
};

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    let metaStr = '';
    
    if (Object.keys(meta).length > 0) {
      metaStr = '\n' + JSON.stringify(meta, null, 2);
    }
    
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Rotate transport for error logs
const errorRotateTransport = new DailyRotateFile({
  filename: path.join(
    process.env.LOG_FILE_PATH || './logs',
    'error-%DATE%.log'
  ),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxFiles: process.env.LOG_MAX_FILES || '14d',
  maxSize: process.env.LOG_MAX_SIZE || '20m',
  format: fileFormat,
  zippedArchive: true,
});

// Rotate transport for all logs
const combinedRotateTransport = new DailyRotateFile({
  filename: path.join(
    process.env.LOG_FILE_PATH || './logs',
    'combined-%DATE%.log'
  ),
  datePattern: 'YYYY-MM-DD',
  maxFiles: process.env.LOG_MAX_FILES || '14d',
  maxSize: process.env.LOG_MAX_SIZE || '20m',
  format: fileFormat,
  zippedArchive: true,
});

// Rotate transport for HTTP logs
const httpRotateTransport = new DailyRotateFile({
  filename: path.join(
    process.env.LOG_FILE_PATH || './logs',
    'http-%DATE%.log'
  ),
  datePattern: 'YYYY-MM-DD',
  level: 'http',
  maxFiles: process.env.LOG_MAX_FILES || '14d',
  maxSize: process.env.LOG_MAX_SIZE || '20m',
  format: fileFormat,
  zippedArchive: true,
});

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // File transports
    errorRotateTransport,
    combinedRotateTransport,
    httpRotateTransport,
  ],
  // Handle exceptions and rejections
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(
        process.env.LOG_FILE_PATH || './logs',
        'exceptions-%DATE%.log'
      ),
      datePattern: 'YYYY-MM-DD',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      format: fileFormat,
      zippedArchive: true,
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(
        process.env.LOG_FILE_PATH || './logs',
        'rejections-%DATE%.log'
      ),
      datePattern: 'YYYY-MM-DD',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      format: fileFormat,
      zippedArchive: true,
    }),
  ],
});

// Create specialized loggers
export const securityLogger = winston.createLogger({
  level: 'info',
  format: fileFormat,
  transports: [
    new DailyRotateFile({
      filename: path.join(
        process.env.LOG_FILE_PATH || './logs',
        'security-%DATE%.log'
      ),
      datePattern: 'YYYY-MM-DD',
      maxFiles: process.env.LOG_MAX_FILES || '30d',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      format: fileFormat,
      zippedArchive: true,
    }),
  ],
});

export const paymentLogger = winston.createLogger({
  level: 'info',
  format: fileFormat,
  transports: [
    new DailyRotateFile({
      filename: path.join(
        process.env.LOG_FILE_PATH || './logs',
        'payment-%DATE%.log'
      ),
      datePattern: 'YYYY-MM-DD',
      maxFiles: process.env.LOG_MAX_FILES || '90d', // Keep payment logs longer
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      format: fileFormat,
      zippedArchive: true,
    }),
  ],
});

export const auditLogger = winston.createLogger({
  level: 'info',
  format: fileFormat,
  transports: [
    new DailyRotateFile({
      filename: path.join(
        process.env.LOG_FILE_PATH || './logs',
        'audit-%DATE%.log'
      ),
      datePattern: 'YYYY-MM-DD',
      maxFiles: process.env.LOG_MAX_FILES || '365d', // Keep audit logs for a year
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      format: fileFormat,
      zippedArchive: true,
    }),
  ],
});

// Helper methods for structured logging
export const logRequest = (req: any, res: any, responseTime: number) => {
  logger.http('HTTP Request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userId: req.user?.id,
    requestId: req.id,
  });
};

export const logError = (error: Error, context?: any) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    ...context,
  });
};

export const logSecurity = (event: string, details: any) => {
  securityLogger.info(event, {
    timestamp: new Date().toISOString(),
    ...details,
  });
};

export const logPayment = (event: string, details: any) => {
  paymentLogger.info(event, {
    timestamp: new Date().toISOString(),
    ...details,
  });
};

export const logAudit = (userId: string, action: string, details: any) => {
  auditLogger.info('Audit Log', {
    timestamp: new Date().toISOString(),
    userId,
    action,
    ...details,
  });
};

// Stream for Morgan HTTP logger
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export default logger;