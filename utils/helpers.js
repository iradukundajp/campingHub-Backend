const crypto = require('crypto');

// Generate random string
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate unique filename
const generateUniqueFilename = (originalName) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const extension = originalName.split('.').pop();
  return `${timestamp}-${random}.${extension}`;
};

// Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in miles
};

// Convert degrees to radians
const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

// Format currency
const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

// Format date
const formatDate = (date, options = {}) => {
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  
  return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(new Date(date));
};

// Calculate number of nights between dates
const calculateNights = (checkIn, checkOut) => {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const timeDiff = checkOutDate.getTime() - checkInDate.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
};

// Calculate total price for booking
const calculateBookingPrice = (pricePerNight, checkIn, checkOut, guests = 1) => {
  const nights = calculateNights(checkIn, checkOut);
  return parseFloat(pricePerNight) * nights;
};

// Validate date range
const isValidDateRange = (checkIn, checkOut) => {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return checkInDate >= today && checkOutDate > checkInDate;
};

// Check if dates overlap
const datesOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && start2 < end1;
};

// Paginate results
const paginate = (data, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;
  const paginatedData = data.slice(offset, offset + limit);
  
  return {
    data: paginatedData,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: data.length,
      totalPages: Math.ceil(data.length / limit),
      hasNext: offset + limit < data.length,
      hasPrev: page > 1
    }
  };
};

// Generate pagination metadata for database queries
const getPaginationParams = (page = 1, limit = 10) => {
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 items per page
  const skip = (pageNum - 1) * limitNum;
  
  return {
    skip,
    take: limitNum,
    page: pageNum,
    limit: limitNum
  };
};

// Format response with pagination
const formatPaginatedResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
};

// Sanitize user input
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
};

// Generate search query for database
const buildSearchQuery = (searchTerm) => {
  if (!searchTerm) return {};
  
  const sanitized = sanitizeInput(searchTerm);
  
  return {
    OR: [
      { title: { contains: sanitized, mode: 'insensitive' } },
      { description: { contains: sanitized, mode: 'insensitive' } },
      { location: { contains: sanitized, mode: 'insensitive' } }
    ]
  };
};

// Calculate average rating
const calculateAverageRating = (reviews) => {
  if (!reviews || reviews.length === 0) return 0;
  
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return Math.round((total / reviews.length) * 10) / 10; // Round to 1 decimal place
};

// Generate booking confirmation number
const generateBookingConfirmation = () => {
  const prefix = 'CH'; // CampingHub
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

// Check if user can cancel booking
const canCancelBooking = (booking, hoursBeforeCheckIn = 24) => {
  const checkInDate = new Date(booking.checkIn);
  const now = new Date();
  const hoursUntilCheckIn = (checkInDate - now) / (1000 * 60 * 60);
  
  return hoursUntilCheckIn >= hoursBeforeCheckIn && 
         !['CANCELLED', 'COMPLETED'].includes(booking.status);
};

// Format API response
const formatApiResponse = (success, data = null, message = '', errors = []) => {
  const response = {
    success,
    timestamp: new Date().toISOString()
  };
  
  if (message) response.message = message;
  if (data) response.data = data;
  if (errors.length > 0) response.errors = errors;
  
  return response;
};

// Extract file extension
const getFileExtension = (filename) => {
  return filename.split('.').pop().toLowerCase();
};

// Check if file type is allowed
const isAllowedFileType = (filename, allowedTypes = ['jpg', 'jpeg', 'png', 'gif']) => {
  const extension = getFileExtension(filename);
  return allowedTypes.includes(extension);
};

// Convert file size to human readable format
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Debounce function
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function
const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Sleep function for async operations
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

module.exports = {
  generateRandomString,
  generateUniqueFilename,
  calculateDistance,
  formatCurrency,
  formatDate,
  calculateNights,
  calculateBookingPrice,
  isValidDateRange,
  datesOverlap,
  paginate,
  getPaginationParams,
  formatPaginatedResponse,
  sanitizeInput,
  buildSearchQuery,
  calculateAverageRating,
  generateBookingConfirmation,
  canCancelBooking,
  formatApiResponse,
  getFileExtension,
  isAllowedFileType,
  formatFileSize,
  debounce,
  throttle,
  sleep
};