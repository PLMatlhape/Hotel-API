import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import crypto from 'crypto';
import { AuthRequest } from '../types/index.js';

// Extended request used in middleware where we add custom properties
interface ExtendedRequest extends Request {
  id?: string;
  rateLimit?: { resetTime?: number } | any;
  session: any;
  user?: any;
  connection: any;
}

// Rate limiting configuration
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: ExtendedRequest, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      retryAfter: req.rateLimit?.resetTime
    });
    return;
  }
});

// Strict rate limit for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per 15 minutes
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later.',
});

// Payment endpoint rate limiter
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 payment attempts per hour
  message: 'Too many payment attempts, please contact support.',
});

// Speed limiter for suspicious activity
// Keep the original exponential delay behaviour: each request beyond `delayAfter`
// adds an additional 500ms delay. express-slow-down v2 changed the shape of
// `delayMs`, so provide a function matching the old behaviour to avoid the
// deprecation warning and preserve intended behavior.
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  // (used, req) => additional delay in ms for each request above delayAfter
  // typed as any to avoid type mismatches from the dependency's typings
  delayMs: (used: number, req: any) => {
    const delayAfter = req?.slowDown?.limit ?? 50;
    return Math.max(0, (used - delayAfter) * 500);
  },
  // keep default validation behavior
  validate: { delayMs: true },
});

// Enhanced helmet configuration
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
});

// SQL injection prevention middleware
export const sanitizeInput = [
  mongoSanitize(), // Remove $ and . from user input
  xss(), // Clean XSS attacks
];

// HTTP Parameter Pollution protection
export const preventParamPollution = hpp({
  whitelist: ['page', 'limit', 'sort', 'amenities', 'star_rating']
});

// CSRF protection for state-changing operations
export const csrfProtection = (req: ExtendedRequest, res: Response, next: NextFunction): void => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.headers['x-csrf-token'] as string;
    const sessionToken = req.session?.csrfToken;
    
    if (!token || token !== sessionToken) {
      res.status(403).json({
        success: false,
        error: 'Invalid CSRF token'
      });
      return;
    }
  }
  next();
};

// Request ID for tracing
export const requestId = (req: ExtendedRequest, res: Response, next: NextFunction): void => {
  req.id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id as string);
  next();
};

// IP whitelist/blacklist
const blacklistedIPs = new Set<string>();
const whitelistedIPs = new Set<string>(
  (process.env.WHITELISTED_IPS || '').split(',').filter(Boolean)
);

export const ipFilter = (req: ExtendedRequest, res: Response, next: NextFunction): void => {
  const clientIP = req.ip || req.connection?.remoteAddress || '';
  
  if (blacklistedIPs.has(clientIP)) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    });
    return;
  }
  
  // If whitelist is configured, only allow whitelisted IPs for admin routes
  if (whitelistedIPs.size > 0 && req.path.startsWith('/api/admin')) {
    if (!whitelistedIPs.has(clientIP)) {
      res.status(403).json({
        success: false,
        error: 'Access denied from this IP'
      });
      return;
    }
  }
  
  next();
};

// Add IP to blacklist
export const blacklistIP = (ip: string) => {
  blacklistedIPs.add(ip);
};

// Remove IP from blacklist
export const whitelistIP = (ip: string) => {
  blacklistedIPs.delete(ip);
  whitelistedIPs.add(ip);
};

// Request validation middleware
export const validateContentType = (req: Request, res: Response, next: NextFunction): void => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    
    if (!contentType || !contentType.includes('application/json')) {
      res.status(415).json({
        success: false,
        error: 'Content-Type must be application/json'
      });
      return;
    }
  }
  next();
};

// API key validation for third-party integrations
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;
  const validApiKeys = (process.env.API_KEYS || '').split(',').filter(Boolean);

  if (!apiKey || !validApiKeys.includes(apiKey)) {
    res.status(401).json({
      success: false,
      error: 'Invalid or missing API key'
    });
    return;
  }

  next();
};

// Brute force protection with exponential backoff
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

export const bruteForceProtection = (req: Request, res: Response, next: NextFunction): void => {
  const identifier = (req as any).body?.email || req.ip;
  const now = Date.now();
  const attempt = loginAttempts.get(identifier);

  if (attempt) {
    const timeSinceLastAttempt = now - attempt.lastAttempt;
    const requiredDelay = Math.min(Math.pow(2, attempt.count) * 1000, 60000); // Max 1 minute

    if (timeSinceLastAttempt < requiredDelay) {
      res.status(429).json({
        success: false,
        error: 'Too many failed attempts. Please wait before trying again.',
        retryAfter: Math.ceil((requiredDelay - timeSinceLastAttempt) / 1000)
      });
      return;
    }
  }

  // Store middleware reference for controller to update attempts
  (res.locals as any).updateLoginAttempts = (success: boolean) => {
    if (success) {
      loginAttempts.delete(identifier);
    } else {
      const current = loginAttempts.get(identifier);
      loginAttempts.set(identifier, {
        count: (current?.count || 0) + 1,
        lastAttempt: now
      });
    }
  };

  next();
};

// Clean up old login attempts every hour
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [key, value] of loginAttempts.entries()) {
    if (now - value.lastAttempt > oneHour) {
      loginAttempts.delete(key);
    }
  }
}, 60 * 60 * 1000);

// Secure cookie options
export const secureCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Request size limiter
export const requestSizeLimiter = (req: Request, res: Response, next: NextFunction): void => {
  // Skip size check for auth endpoints, user endpoints, and GET requests (which don't have bodies)
  if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/users') || req.method === 'GET') {
    return next();
  }
  // Helper to parse human-friendly sizes: '10', '10mb', '50mb', '10485760', '1gb'
  const parseSize = (sizeStr: string): number => {
    if (!sizeStr) return 50 * 1024 * 1024; // default 50MB
    const s = String(sizeStr).trim().toLowerCase();

    // match number with optional unit
    const match = s.match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/);
    if (!match) {
      // fallback to 50MB
      return 50 * 1024 * 1024;
    }

  // match[1] and match[2] are strings but may be undefined in some TS configs;
  // guard defensively and provide defaults to satisfy strict checks.
  const valueStr = match[1] ?? '0';
  const value = parseFloat(valueStr);
  const unit = match[2] || 'mb'; // treat bare numbers as megabytes

    switch (unit) {
      case 'b':
        return Math.round(value);
      case 'kb':
        return Math.round(value * 1024);
      case 'mb':
        return Math.round(value * 1024 * 1024);
      case 'gb':
        return Math.round(value * 1024 * 1024 * 1024);
      default:
        return Math.round(value * 1024 * 1024);
    }
  };

  const rawMax = process.env.MAX_REQUEST_SIZE || '50mb';
  const maxSize = parseSize(rawMax);

  const contentLengthHeader = req.headers['content-length'];
  const contentLength = contentLengthHeader ? parseInt(String(contentLengthHeader), 10) : NaN;

  // If there's no content-length header or it's not a number, allow the request to continue
  if (isNaN(contentLength)) {
    return next();
  }

  if (contentLength > maxSize) {
    const toMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2) + 'MB';

    res.status(413).json({
      success: false,
      error: 'Request entity too large',
      maxSizeBytes: maxSize,
      maxSizeHuman: toMB(maxSize),
      currentBytes: contentLength,
      currentHuman: toMB(contentLength),
      note: "Set MAX_REQUEST_SIZE in .env (e.g. '100mb') to increase the limit. Bare numbers are treated as megabytes."
    });
    return;
  }

  next();
};

// Security audit logger
export const securityLogger = (req: ExtendedRequest, res: Response, next: NextFunction): void => {
  const securityEvents = ['POST', 'PUT', 'DELETE', 'PATCH'];
  
  if (securityEvents.includes(req.method) || req.path.includes('admin')) {
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ip: req.ip,
      userId: req.user?.id,
      userAgent: req.headers['user-agent'],
      requestId: req.id
    };
    
    // Log to your security monitoring system
    console.log('[SECURITY]', JSON.stringify(logData));
  }
  
  next();
};
