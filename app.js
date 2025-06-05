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
      'http://localhost:3000'
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
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Database middleware
app.use(async (req, res, next) => {
  try {
    if (!prismaInstance) {
      prismaInstance = await initializeDatabase();
    }
    req.prisma = prismaInstance;
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      message: 'Database connection failed'
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    if (req.prisma) {
      await req.prisma.$queryRaw`SELECT 1`;
    }
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString()
    });
  }
});

// API routes
app.use('/api', indexRouter);
app.use('/api/users', usersRouter);
app.use('/api/owners', ownersRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/admin', adminRouter);

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/api');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.statusCode || 500).json({
    message: err.message || 'Internal server error'
  });
});

module.exports = app;