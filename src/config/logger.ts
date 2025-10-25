import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// Extended logger interface (declared early so we can cast the logger)
export interface LoggerWithExtensions extends winston.Logger {
  addReqId: (reqId: string) => winston.Logger;
  addUser: (userId: string) => winston.Logger;
  timer: (label: string) => { end: () => number };
  security: (event: string, details: any) => void;
  business: (action: string, details: any) => void;
  performance: (metric: string, value: number, unit?: string) => void;
  database: (operation: string, details: any) => void;
  api: (method: string, path: string, statusCode: number, responseTime: number, userId?: string) => void;
}

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(logColors);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} ${level}: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    return logMessage;
  })
);

// Create transports array
const transports: winston.transport[] = [];

// Console transport for development
if (process.env.NODE_ENV === 'development') {
  transports.push(
    new winston.transports.Console({
      level: 'debug',
      format: consoleFormat,
    })
  );
} else {
  // Console transport for production (less verbose)
  transports.push(
    new winston.transports.Console({
      level: 'info',
      format: logFormat,
    })
  );
}

// File transports for all environments
transports.push(
  // Error logs
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    format: logFormat,
    maxSize: '20m',
    maxFiles: '14d',
    auditFile: path.join(logsDir, 'error-audit.json'),
    zippedArchive: true,
  }),

  // Combined logs
  new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'info',
    format: logFormat,
    maxSize: '20m',
    maxFiles: '14d',
    auditFile: path.join(logsDir, 'combined-audit.json'),
    zippedArchive: true,
  })
);

// Add HTTP request logs in development
if (process.env.NODE_ENV === 'development') {
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'http-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'http',
      format: logFormat,
      maxSize: '20m',
      maxFiles: '7d',
      auditFile: path.join(logsDir, 'http-audit.json'),
      zippedArchive: true,
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
  levels: logLevels,
  format: logFormat,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: logFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: logFormat,
    }),
  ],
}) as unknown as LoggerWithExtensions;

// Add request ID tracking
logger.addReqId = (reqId: string) => {
  return logger.child({ reqId });
};

// Add user tracking
logger.addUser = (userId: string) => {
  return logger.child({ userId });
};

// Performance timing helper
logger.timer = (label: string) => {
  const start = Date.now();
  return {
    end: () => {
      const duration = Date.now() - start;
      logger.debug(`${label} completed in ${duration}ms`);
      return duration;
    },
  };
};

// Security event logging
logger.security = (event: string, details: any) => {
  logger.warn('Security Event', {
    event,
    ...details,
    timestamp: new Date().toISOString(),
  });
};

// Business logic logging
logger.business = (action: string, details: any) => {
  logger.info('Business Action', {
    action,
    ...details,
    timestamp: new Date().toISOString(),
  });
};

// Performance logging
logger.performance = (metric: string, value: number, unit: string = 'ms') => {
  logger.info('Performance Metric', {
    metric,
    value,
    unit,
    timestamp: new Date().toISOString(),
  });
};

// Database operation logging
logger.database = (operation: string, details: any) => {
  logger.debug('Database Operation', {
    operation,
    ...details,
    timestamp: new Date().toISOString(),
  });
};

// API logging
logger.api = (method: string, path: string, statusCode: number, responseTime: number, userId?: string) => {
  logger.http('API Request', {
    method,
    path,
    statusCode,
    responseTime: `${responseTime}ms`,
    userId,
    timestamp: new Date().toISOString(),
  });
};

// Export logger
export default logger;