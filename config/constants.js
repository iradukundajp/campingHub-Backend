// Application Constants

// User Roles
const USER_ROLES = {
  USER: 'USER',
  OWNER: 'OWNER',
  ADMIN: 'ADMIN'
};

// Booking Status
const BOOKING_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  REFUNDED: 'REFUNDED'
};

// Payment Status
const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED'
};

// Camping Spot Status
const SPOT_STATUS = {
  ACTIVE: true,
  INACTIVE: false
};

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500
};

// API Messages
const MESSAGES = {
  // Success Messages
  SUCCESS: {
    USER_REGISTERED: 'User registered successfully',
    USER_LOGGED_IN: 'Login successful',
    PROFILE_UPDATED: 'Profile updated successfully',
    PASSWORD_CHANGED: 'Password changed successfully',
    BOOKING_CREATED: 'Booking created successfully',
    BOOKING_CANCELLED: 'Booking cancelled successfully',
    SPOT_CREATED: 'Camping spot created successfully',
    SPOT_UPDATED: 'Camping spot updated successfully',
    SPOT_DELETED: 'Camping spot deleted successfully',
    REVIEW_ADDED: 'Review added successfully'
  },
  
  // Error Messages
  ERROR: {
    INTERNAL_SERVER: 'Internal server error',
    DATABASE_CONNECTION: 'Database connection failed',
    INVALID_CREDENTIALS: 'Invalid email or password',
    EMAIL_EXISTS: 'User with this email already exists',
    USER_NOT_FOUND: 'User not found',
    BOOKING_NOT_FOUND: 'Booking not found',
    SPOT_NOT_FOUND: 'Camping spot not found',
    ACCESS_DENIED: 'Access denied',
    TOKEN_REQUIRED: 'Access token required',
    INVALID_TOKEN: 'Invalid or expired token',
    OWNER_PRIVILEGES_REQUIRED: 'Owner privileges required',
    ADMIN_PRIVILEGES_REQUIRED: 'Admin privileges required'
  },
  
  // Validation Messages
  VALIDATION: {
    REQUIRED_FIELDS: 'All required fields must be provided',
    INVALID_EMAIL: 'Please provide a valid email address',
    PASSWORD_LENGTH: 'Password must be at least 6 characters long',
    INVALID_PRICE: 'Price must be greater than 0',
    INVALID_CAPACITY: 'Capacity must be greater than 0',
    INVALID_GUESTS: 'Number of guests must be greater than 0',
    INVALID_RATING: 'Rating must be between 1 and 5',
    DATES_INVALID: 'Check-out date must be after check-in date',
    PAST_DATE: 'Check-in date cannot be in the past',
    BOOKING_UNAVAILABLE: 'The selected dates are not available',
    CAPACITY_EXCEEDED: 'Number of guests exceeds spot capacity',
    CANCELLATION_POLICY: 'Bookings can only be cancelled at least 24 hours before check-in'
  }
};

// Default Values
const DEFAULTS = {
  PAGINATION: {
    PAGE: 1,
    LIMIT: 10,
    MAX_LIMIT: 100
  },
  
  BOOKING: {
    CANCELLATION_HOURS: 24
  },
  
  JWT: {
    EXPIRES_IN: '24h'
  },
  
  BCRYPT: {
    SALT_ROUNDS: 12
  }
};

// File Upload Limits
const UPLOAD_LIMITS = {
  IMAGE: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/jpg'],
    MAX_FILES: 10
  }
};

// Email Templates
const EMAIL_TEMPLATES = {
  WELCOME: 'welcome',
  BOOKING_CONFIRMATION: 'booking_confirmation',
  BOOKING_CANCELLATION: 'booking_cancellation',
  PASSWORD_RESET: 'password_reset'
};

module.exports = {
  USER_ROLES,
  BOOKING_STATUS,
  PAYMENT_STATUS,
  SPOT_STATUS,
  HTTP_STATUS,
  MESSAGES,
  DEFAULTS,
  UPLOAD_LIMITS,
  EMAIL_TEMPLATES
};