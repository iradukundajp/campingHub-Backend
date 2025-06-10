require('dotenv').config();

var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var morgan = require('morgan');
var cors = require('cors');

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

// Import database configuration
const database = require('./config/database');

// Import routes
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var ownersRouter = require('./routes/owners');
var bookingsRouter = require('./routes/bookings');
var adminRouter = require('./routes/admin');
var uploadRouter = require('./routes/upload'); // ADDED: Upload route

var app = express();

// Initialize database connection
let prismaInstance = null;

const initializeDatabase = async () => {
  try {
    if (!prismaInstance) {
      prismaInstance = await database.connect();
      console.log('✅ Database connection established');
    }
    return prismaInstance;
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    throw error;
  }
};

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:8080',
      'http://localhost:3000',
      'http://localhost:5173' // Add Vite default port
    ];
    
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

// Basic middleware
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json({ 
  limit: '10mb',
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: false,
  limit: '10mb'
}));
app.use(cookieParser());

// ADDED: Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Database middleware with improved error handling
app.use(async (req, res, next) => {
  try {
    if (!prismaInstance) {
      prismaInstance = await initializeDatabase();
    }
    
    // Ensure connection is still alive
    req.prisma = await database.ensureConnection();
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(503).json({
      message: 'Database connection failed. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await database.healthCheck();
    
    const healthStatus = {
      status: dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: dbHealth,
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime()
    };
    
    const statusCode = dbHealth.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// API routes
app.use('/api', indexRouter);
app.use('/api/users', usersRouter);
app.use('/api/owners', ownersRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/upload', uploadRouter); // ADDED: Upload route

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/api');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation error',
      errors: err.errors
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Token expired'
    });
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      message: 'CORS policy violation'
    });
  }

  // Handle Prisma errors
  if (err.code) {
    switch (err.code) {
      case 'P2002':
        return res.status(409).json({
          message: 'Duplicate entry. Resource already exists.'
        });
      case 'P2025':
        return res.status(404).json({
          message: 'Record not found'
        });
      case 'P2003':
        return res.status(400).json({
          message: 'Invalid reference'
        });
      default:
        console.error('Unhandled Prisma error:', err.code, err.message);
    }
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? {
      stack: err.stack,
      code: err.code
    } : undefined,
    timestamp: new Date().toISOString()
  });
});

// Handle promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app;