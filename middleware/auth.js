const jwt = require('jsonwebtoken');

// 🆕 ENHANCED: Middleware to verify JWT token with better debugging
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        message: 'Access token required',
        code: 'TOKEN_MISSING'
      });
    }

    // 🆕 ENHANCED: Better JWT verification with user data extraction
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 🆕 ENHANCED: Support both userId and id fields for compatibility
    req.user = {
      userId: decoded.userId || decoded.id, // Support both formats
      email: decoded.email,
      role: decoded.role,
      isActive: decoded.isActive !== false // Default to true if not specified
    };

    // 🆕 ENHANCED: Development logging for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('🔐 Auth successful:', {
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role,
        endpoint: req.originalUrl
      });
    }

    // 🆕 ENHANCED: Check if user account is active
    if (req.user.isActive === false) {
      return res.status(403).json({
        message: 'Account is deactivated',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid access token',
        code: 'TOKEN_INVALID'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Access token expired',
        code: 'TOKEN_EXPIRED'
      });
    } else {
      return res.status(500).json({
        message: 'Authentication verification failed',
        code: 'AUTH_ERROR',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

// 🆕 ENHANCED: Middleware to check if user is an owner with better debugging
const requireOwner = async (req, res, next) => {
  try {
    // Check if user is authenticated first
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
    }

    const userRole = req.user.role;
    
    // Allow OWNER and ADMIN roles
    if (userRole === 'OWNER' || userRole === 'ADMIN') {
      // 🆕 ENHANCED: Log access for monitoring in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`🏠 Owner access granted: ${req.user.email} (${userRole}) accessing ${req.originalUrl}`);
      }
      next();
    } else {
      console.warn(`⚠️ Owner access denied: ${req.user.email} (${userRole}) attempted to access ${req.originalUrl}`);
      return res.status(403).json({
        message: 'Owner privileges required',
        code: 'INSUFFICIENT_PRIVILEGES',
        requiredRole: 'OWNER',
        currentRole: userRole
      });
    }
  } catch (error) {
    console.error('Owner role check error:', error);
    return res.status(500).json({
      message: 'Role verification failed',
      code: 'ROLE_CHECK_ERROR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 🆕 ENHANCED: Middleware to check if user is an admin with better debugging
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
    }

    const userRole = req.user.role;
    
    if (userRole === 'ADMIN') {
      if (process.env.NODE_ENV === 'development') {
        console.log(`👑 Admin access granted: ${req.user.email} accessing ${req.originalUrl}`);
      }
      next();
    } else {
      console.warn(`⚠️ Admin access denied: ${req.user.email} (${userRole}) attempted to access ${req.originalUrl}`);
      return res.status(403).json({
        message: 'Administrator privileges required',
        code: 'INSUFFICIENT_PRIVILEGES',
        requiredRole: 'ADMIN',
        currentRole: userRole
      });
    }
  } catch (error) {
    console.error('Admin role check error:', error);
    return res.status(500).json({
      message: 'Role verification failed',
      code: 'ROLE_CHECK_ERROR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 🆕 ENHANCED: Flexible middleware to authorize multiple roles
const authorizeRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
      }

      const userRole = req.user.role;
      
      if (allowedRoles.includes(userRole)) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Role access granted: ${req.user.email} (${userRole}) accessing ${req.originalUrl}`);
        }
        next();
      } else {
        console.warn(`⚠️ Role access denied: ${req.user.email} (${userRole}) attempted to access ${req.originalUrl}`);
        return res.status(403).json({
          message: 'Insufficient privileges',
          code: 'INSUFFICIENT_PRIVILEGES',
          allowedRoles,
          currentRole: userRole
        });
      }
    } catch (error) {
      console.error('Role requirement check error:', error);
      return res.status(500).json({
        message: 'Role verification failed',
        code: 'ROLE_CHECK_ERROR',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};

// 🆕 ENHANCED: Optional authentication middleware (for routes that work with or without auth)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
          userId: decoded.userId || decoded.id,
          email: decoded.email,
          role: decoded.role,
          isActive: decoded.isActive !== false
        };
      } catch (error) {
        // Token is invalid but that's okay for optional auth
        if (process.env.NODE_ENV === 'development') {
          console.log('Optional auth: Invalid token provided, proceeding without auth');
        }
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next(); // Continue without auth
  }
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

// 🆕 ENHANCED: Middleware to check ownership of resources with better error handling
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

// 🆕 ENHANCED: Logging middleware for authenticated requests with better debugging
const logAuthenticatedRequest = (req, res, next) => {
  if (req.user && process.env.NODE_ENV === 'development') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - User: ${req.user.userId} (${req.user.role})`);
  }
  next();
};

// 🆕 NEW: Health check middleware to verify middleware setup
const healthCheck = (req, res, next) => {
  req.healthCheck = {
    timestamp: new Date().toISOString(),
    middleware: 'auth',
    version: '2.0.0'
  };
  next();
};

// 🆕 NEW: Middleware to ensure user data is fresh from database (for critical operations)
const refreshUserData = async (req, res, next) => {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        isVerified: true
      }
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Update req.user with fresh data
    req.user = {
      ...req.user,
      role: user.role,
      isActive: user.isActive,
      isVerified: user.isVerified
    };

    next();
  } catch (error) {
    console.error('Error refreshing user data:', error);
    return res.status(500).json({
      message: 'Error refreshing user data',
      code: 'USER_REFRESH_ERROR'
    });
  }
};

module.exports = {
  authenticateToken,
  requireOwner,
  requireAdmin,
  authorizeRole,
  optionalAuth, // 🆕 NEW
  requireActiveAccount,
  requireVerifiedAccount,
  requireResourceOwnership,
  createRateLimiter,
  validateRequestSize,
  logAuthenticatedRequest,
  healthCheck, // 🆕 NEW
  refreshUserData // 🆕 NEW
};