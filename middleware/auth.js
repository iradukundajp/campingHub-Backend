const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      message: 'Access token required',
      code: 'TOKEN_MISSING'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      let message = 'Invalid or expired token';
      let code = 'TOKEN_INVALID';
      
      if (err.name === 'TokenExpiredError') {
        message = 'Token has expired';
        code = 'TOKEN_EXPIRED';
      } else if (err.name === 'JsonWebTokenError') {
        message = 'Invalid token format';
        code = 'TOKEN_MALFORMED';
      }
      
      return res.status(403).json({ 
        message,
        code
      });
    }
    
    req.user = user;
    next();
  });
};

// Middleware to check if user is an owner
const requireOwner = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ 
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  if (req.user.role !== 'OWNER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ 
      message: 'Access denied. Owner privileges required.',
      code: 'INSUFFICIENT_PERMISSIONS',
      required: ['OWNER', 'ADMIN'],
      current: req.user.role
    });
  }
  next();
};

// Middleware to check if user is an admin
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ 
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ 
      message: 'Access denied. Admin privileges required.',
      code: 'INSUFFICIENT_PERMISSIONS',
      required: ['ADMIN'],
      current: req.user.role
    });
  }
  next();
};

// Flexible middleware to authorize multiple roles
const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        required: allowedRoles,
        current: req.user.role
      });
    }
    
    next();
  };
};

// Middleware to check if user account is active
const requireActiveAccount = (req, res, next) => {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({ 
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // Check user's active status from database
  req.prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { isActive: true, isVerified: true }
  })
  .then(user => {
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (!user.isActive) {
      return res.status(403).json({
        message: 'Account is deactivated. Please contact support.',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }
    
    // Attach user status to request
    req.userStatus = user;
    next();
  })
  .catch(error => {
    console.error('Error checking user status:', error);
    return res.status(500).json({
      message: 'Error verifying account status',
      code: 'VERIFICATION_ERROR'
    });
  });
};

// Middleware to require verified account
const requireVerifiedAccount = (req, res, next) => {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({ 
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // Check user's verification status from database
  req.prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { isVerified: true }
  })
  .then(user => {
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Email verification required. Please check your email and verify your account.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }
    
    next();
  })
  .catch(error => {
    console.error('Error checking verification status:', error);
    return res.status(500).json({
      message: 'Error verifying account status',
      code: 'VERIFICATION_ERROR'
    });
  });
};

// Middleware to check resource ownership
const requireResourceOwnership = (resourceType) => {
  return async (req, res, next) => {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Admin can access all resources
    if (req.user.role === 'ADMIN') {
      return next();
    }
    
    const resourceId = parseInt(req.params.id);
    if (isNaN(resourceId)) {
      return res.status(400).json({
        message: 'Invalid resource ID',
        code: 'INVALID_RESOURCE_ID'
      });
    }
    
    try {
      let resource;
      
      switch (resourceType) {
        case 'spot':
          resource = await req.prisma.campingSpot.findUnique({
            where: { id: resourceId },
            select: { ownerId: true }
          });
          
          if (!resource) {
            return res.status(404).json({
              message: 'Camping spot not found',
              code: 'RESOURCE_NOT_FOUND'
            });
          }
          
          if (resource.ownerId !== req.user.userId) {
            return res.status(403).json({
              message: 'You can only access your own camping spots',
              code: 'OWNERSHIP_REQUIRED'
            });
          }
          break;
          
        case 'booking':
          resource = await req.prisma.booking.findUnique({
            where: { id: resourceId },
            select: { userId: true, spot: { select: { ownerId: true } } }
          });
          
          if (!resource) {
            return res.status(404).json({
              message: 'Booking not found',
              code: 'RESOURCE_NOT_FOUND'
            });
          }
          
          // User can access their own bookings or bookings for their spots
          if (resource.userId !== req.user.userId && resource.spot.ownerId !== req.user.userId) {
            return res.status(403).json({
              message: 'You can only access your own bookings',
              code: 'OWNERSHIP_REQUIRED'
            });
          }
          break;
          
        case 'review':
          resource = await req.prisma.review.findUnique({
            where: { id: resourceId },
            select: { userId: true }
          });
          
          if (!resource) {
            return res.status(404).json({
              message: 'Review not found',
              code: 'RESOURCE_NOT_FOUND'
            });
          }
          
          if (resource.userId !== req.user.userId) {
            return res.status(403).json({
              message: 'You can only access your own reviews',
              code: 'OWNERSHIP_REQUIRED'
            });
          }
          break;
          
        default:
          return res.status(500).json({
            message: 'Unknown resource type',
            code: 'UNKNOWN_RESOURCE_TYPE'
          });
      }
      
      next();
    } catch (error) {
      console.error('Error checking resource ownership:', error);
      return res.status(500).json({
        message: 'Error verifying resource ownership',
        code: 'OWNERSHIP_CHECK_ERROR'
      });
    }
  };
};

// Rate limiting middleware (basic implementation)
const createRateLimiter = (windowMs, maxRequests) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const userId = req.user?.userId || req.ip;
    const now = Date.now();
    
    if (!requests.has(userId)) {
      requests.set(userId, []);
    }
    
    const userRequests = requests.get(userId);
    
    // Clean old requests outside the window
    const validRequests = userRequests.filter(time => now - time < windowMs);
    requests.set(userId, validRequests);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        message: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    validRequests.push(now);
    next();
  };
};

// Middleware to validate request body size
const validateRequestSize = (maxSizeInMB = 10) => {
  return (req, res, next) => {
    const maxSize = maxSizeInMB * 1024 * 1024; // Convert to bytes
    
    if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
      return res.status(413).json({
        message: `Request body too large. Maximum size is ${maxSizeInMB}MB`,
        code: 'REQUEST_TOO_LARGE'
      });
    }
    
    next();
  };
};

// Logging middleware for authenticated requests
const logAuthenticatedRequest = (req, res, next) => {
  if (req.user) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - User: ${req.user.userId} (${req.user.role})`);
  }
  next();
};

module.exports = {
  authenticateToken,
  requireOwner,
  requireAdmin,
  authorizeRole,
  requireActiveAccount,
  requireVerifiedAccount,
  requireResourceOwnership,
  createRateLimiter,
  validateRequestSize,
  logAuthenticatedRequest
};