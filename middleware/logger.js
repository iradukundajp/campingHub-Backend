const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log levels
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

// Color codes for console output
const COLORS = {
  ERROR: '\x1b[31m',   // Red
  WARN: '\x1b[33m',    // Yellow
  INFO: '\x1b[36m',    // Cyan
  DEBUG: '\x1b[90m',   // Gray
  SUCCESS: '\x1b[32m', // Green
  RESET: '\x1b[0m'     // Reset
};

// Get current timestamp
const getTimestamp = () => {
  return new Date().toISOString();
};

// Get log filename based on date
const getLogFilename = (level) => {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logsDir, `${level.toLowerCase()}-${date}.log`);
};

// Write log to file
const writeToFile = (level, message, meta = {}) => {
  const timestamp = getTimestamp();
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta
  };

  const logString = JSON.stringify(logEntry) + '\n';
  const filename = getLogFilename(level);

  fs.appendFileSync(filename, logString);
};

// Console logger with colors
const logToConsole = (level, message, meta = {}) => {
  const timestamp = getTimestamp();
  const color = COLORS[level] || COLORS.RESET;
  
  console.log(
    `${color}[${timestamp}] ${level}:${COLORS.RESET} ${message}`,
    Object.keys(meta).length > 0 ? meta : ''
  );
};

// Main logger class
class Logger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  log(level, message, meta = {}) {
    // Always write to file in production
    if (this.isProduction) {
      writeToFile(level, message, meta);
    }

    // Console output in development or for important messages
    if (!this.isProduction || level === LOG_LEVELS.ERROR) {
      logToConsole(level, message, meta);
    }
  }

  error(message, meta = {}) {
    this.log(LOG_LEVELS.ERROR, message, meta);
  }

  warn(message, meta = {}) {
    this.log(LOG_LEVELS.WARN, message, meta);
  }

  info(message, meta = {}) {
    this.log(LOG_LEVELS.INFO, message, meta);
  }

  debug(message, meta = {}) {
    if (!this.isProduction) {
      this.log(LOG_LEVELS.DEBUG, message, meta);
    }
  }

  success(message, meta = {}) {
    if (!this.isProduction) {
      logToConsole('SUCCESS', message, meta);
    }
  }
}

// Create logger instance
const logger = new Logger();

// Request logging middleware
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request details
  const requestInfo = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user ? req.user.userId : null
  };

  logger.info(`${req.method} ${req.originalUrl}`, requestInfo);

  // Capture response details
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    const responseInfo = {
      ...requestInfo,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: data ? data.length : 0
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error(`${req.method} ${req.originalUrl} - ${res.statusCode}`, responseInfo);
    } else if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.originalUrl} - ${res.statusCode}`, responseInfo);
    } else {
      logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode}`, responseInfo);
    }

    originalSend.call(this, data);
  };

  next();
};

// Security event logger
const securityLogger = (event, details = {}) => {
  logger.warn(`SECURITY EVENT: ${event}`, {
    ...details,
    timestamp: getTimestamp(),
    severity: 'HIGH'
  });
};

// API usage analytics
const analyticsLogger = (req, res, next) => {
  // Skip logging for certain routes
  const skipRoutes = ['/api/health', '/api/test-db'];
  if (skipRoutes.includes(req.path)) {
    return next();
  }

  const analytics = {
    endpoint: req.originalUrl,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: getTimestamp(),
    userId: req.user ? req.user.userId : null,
    userRole: req.user ? req.user.role : null
  };

  // Write to analytics file
  const analyticsFile = path.join(logsDir, 'analytics.log');
  fs.appendFileSync(analyticsFile, JSON.stringify(analytics) + '\n');

  next();
};

// Error logger
const errorLogger = (error, req, res, next) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user ? req.user.userId : null,
    body: req.body,
    query: req.query,
    params: req.params
  };

  logger.error('Application Error', errorInfo);
  next(error);
};

// Clean old log files (keep last 30 days)
const cleanOldLogs = () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const files = fs.readdirSync(logsDir);
    
    files.forEach(file => {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime < thirtyDaysAgo) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted old log file: ${file}`);
      }
    });
  } catch (error) {
    logger.error('Error cleaning old logs', { error: error.message });
  }
};

// Run cleanup daily
setInterval(cleanOldLogs, 24 * 60 * 60 * 1000); // 24 hours

module.exports = {
  logger,
  requestLogger,
  securityLogger,
  analyticsLogger,
  errorLogger,
  LOG_LEVELS
};