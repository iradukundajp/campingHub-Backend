const { HTTP_STATUS, MESSAGES } = require('../config/constants');
const { AppError } = require('./errorHandler');

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation regex (US format)
const phoneRegex = /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/;

// Password strength validation
const validatePassword = (password) => {
  if (!password || password.length < 6) {
    return 'Password must be at least 6 characters long';
  }
  return null;
};

// Email validation
const validateEmail = (email) => {
  if (!email || !emailRegex.test(email)) {
    return 'Please provide a valid email address';
  }
  return null;
};

// Phone validation
const validatePhone = (phone) => {
  if (phone && !phoneRegex.test(phone)) {
    return 'Please provide a valid phone number';
  }
  return null;
};

// Date validation
const validateDate = (date, fieldName = 'Date') => {
  if (!date) {
    return `${fieldName} is required`;
  }
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return `${fieldName} must be a valid date`;
  }
  
  return null;
};

// Number validation
const validateNumber = (value, fieldName = 'Value', min = null, max = null) => {
  if (value === undefined || value === null) {
    return `${fieldName} is required`;
  }
  
  const num = parseFloat(value);
  if (isNaN(num)) {
    return `${fieldName} must be a valid number`;
  }
  
  if (min !== null && num < min) {
    return `${fieldName} must be at least ${min}`;
  }
  
  if (max !== null && num > max) {
    return `${fieldName} must not exceed ${max}`;
  }
  
  return null;
};

// User registration validation
const validateUserRegistration = (req, res, next) => {
  const { email, password, firstName, lastName, phone } = req.body;
  const errors = [];

  // Required fields
  if (!email) errors.push('Email is required');
  if (!password) errors.push('Password is required');
  if (!firstName) errors.push('First name is required');
  if (!lastName) errors.push('Last name is required');

  // Email validation
  const emailError = validateEmail(email);
  if (emailError) errors.push(emailError);

  // Password validation
  const passwordError = validatePassword(password);
  if (passwordError) errors.push(passwordError);

  // Phone validation (optional)
  const phoneError = validatePhone(phone);
  if (phoneError) errors.push(phoneError);

  // Name length validation
  if (firstName && (firstName.length < 2 || firstName.length > 50)) {
    errors.push('First name must be between 2 and 50 characters');
  }
  if (lastName && (lastName.length < 2 || lastName.length > 50)) {
    errors.push('Last name must be between 2 and 50 characters');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), HTTP_STATUS.BAD_REQUEST));
  }

  next();
};

// User login validation
const validateUserLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email) errors.push('Email is required');
  if (!password) errors.push('Password is required');

  const emailError = validateEmail(email);
  if (emailError) errors.push(emailError);

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), HTTP_STATUS.BAD_REQUEST));
  }

  next();
};

// Camping spot validation
const validateCampingSpot = (req, res, next) => {
  const { title, description, location, price, capacity } = req.body;
  const errors = [];

  // Required fields
  if (!title) errors.push('Title is required');
  if (!description) errors.push('Description is required');
  if (!location) errors.push('Location is required');
  if (price === undefined || price === null) errors.push('Price is required');
  if (capacity === undefined || capacity === null) errors.push('Capacity is required');

  // Length validations
  if (title && (title.length < 5 || title.length > 100)) {
    errors.push('Title must be between 5 and 100 characters');
  }
  if (description && (description.length < 20 || description.length > 2000)) {
    errors.push('Description must be between 20 and 2000 characters');
  }

  // Price validation
  const priceError = validateNumber(price, 'Price', 0.01);
  if (priceError) errors.push(priceError);

  // Capacity validation
  const capacityError = validateNumber(capacity, 'Capacity', 1, 50);
  if (capacityError) errors.push(capacityError);

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), HTTP_STATUS.BAD_REQUEST));
  }

  next();
};

// Booking validation
const validateBooking = (req, res, next) => {
  const { spotId, checkIn, checkOut, guests } = req.body;
  const errors = [];

  // Required fields
  if (!spotId) errors.push('Camping spot ID is required');
  if (!checkIn) errors.push('Check-in date is required');
  if (!checkOut) errors.push('Check-out date is required');
  if (guests === undefined || guests === null) errors.push('Number of guests is required');

  // Date validations
  const checkInError = validateDate(checkIn, 'Check-in date');
  if (checkInError) errors.push(checkInError);

  const checkOutError = validateDate(checkOut, 'Check-out date');
  if (checkOutError) errors.push(checkOutError);

  // Guests validation
  const guestsError = validateNumber(guests, 'Number of guests', 1, 20);
  if (guestsError) errors.push(guestsError);

  // Date logic validation
  if (checkIn && checkOut) {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkInDate < today) {
      errors.push('Check-in date cannot be in the past');
    }

    if (checkOutDate <= checkInDate) {
      errors.push('Check-out date must be after check-in date');
    }

    // Maximum booking duration (30 days)
    const daysDiff = (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24);
    if (daysDiff > 30) {
      errors.push('Maximum booking duration is 30 days');
    }
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), HTTP_STATUS.BAD_REQUEST));
  }

  next();
};

// Review validation
const validateReview = (req, res, next) => {
  const { rating, comment } = req.body;
  const errors = [];

  // Rating validation
  const ratingError = validateNumber(rating, 'Rating', 1, 5);
  if (ratingError) errors.push(ratingError);

  // Comment validation (optional)
  if (comment && (comment.length < 10 || comment.length > 1000)) {
    errors.push('Comment must be between 10 and 1000 characters');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), HTTP_STATUS.BAD_REQUEST));
  }

  next();
};

// Search and filter validation
const validateSearchParams = (req, res, next) => {
  const { minPrice, maxPrice, capacity, page, limit } = req.query;
  const errors = [];

  // Price validation
  if (minPrice) {
    const minPriceError = validateNumber(minPrice, 'Minimum price', 0);
    if (minPriceError) errors.push(minPriceError);
  }

  if (maxPrice) {
    const maxPriceError = validateNumber(maxPrice, 'Maximum price', 0);
    if (maxPriceError) errors.push(maxPriceError);
  }

  if (minPrice && maxPrice && parseFloat(minPrice) > parseFloat(maxPrice)) {
    errors.push('Minimum price cannot be greater than maximum price');
  }

  // Capacity validation
  if (capacity) {
    const capacityError = validateNumber(capacity, 'Capacity', 1);
    if (capacityError) errors.push(capacityError);
  }

  // Pagination validation
  if (page) {
    const pageError = validateNumber(page, 'Page', 1);
    if (pageError) errors.push(pageError);
  }

  if (limit) {
    const limitError = validateNumber(limit, 'Limit', 1, 100);
    if (limitError) errors.push(limitError);
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), HTTP_STATUS.BAD_REQUEST));
  }

  next();
};

// Sanitize input data
const sanitizeInput = (req, res, next) => {
  // Remove any potential HTML/JS from string inputs
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str.trim().replace(/<script[^>]*>.*<\/script>/gi, '');
  };

  // Recursively sanitize object properties
  const sanitizeObject = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = sanitizeString(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);

  next();
};

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateCampingSpot,
  validateBooking,
  validateReview,
  validateSearchParams,
  sanitizeInput,
  validateEmail,
  validatePassword,
  validatePhone,
  validateDate,
  validateNumber
};