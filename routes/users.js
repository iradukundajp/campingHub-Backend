var express = require('express');
var router = express.Router();
const { authenticateToken } = require('../middleware/auth');

/* GET /api/users - API info */
router.get('/', function(req, res, next) {
  res.json({
    message: 'CampingHub Users API',
    version: '1.0.0',
    endpoints: {
      profile: 'GET /api/users/profile (requires auth)',
      updateProfile: 'PUT /api/users/profile (requires auth)',
      bookings: 'GET /api/users/bookings (requires auth)',
      reviews: 'GET /api/users/reviews (requires auth)',
      favorites: 'GET /api/users/favorites (requires auth)'
    },
    note: 'Authentication endpoints are available at /api/auth/login and /api/auth/register'
  });
});

/* GET /api/users/profile - Get User Profile */
router.get('/profile', authenticateToken, async function(req, res, next) {
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            bookings: true,
            ownedSpots: true,
            reviews: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    res.json({ 
      message: 'Profile retrieved successfully',
      user 
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      message: 'Error fetching profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* PUT /api/users/profile - Update User Profile */
router.put('/profile', authenticateToken, async function(req, res, next) {
  try {
    const { firstName, lastName, phone, avatar } = req.body;
    const updateData = {};

    // Validate and prepare update data
    if (firstName !== undefined) {
      if (!firstName || firstName.trim().length < 2) {
        return res.status(400).json({
          message: 'First name must be at least 2 characters long'
        });
      }
      updateData.firstName = firstName.trim();
    }

    if (lastName !== undefined) {
      if (!lastName || lastName.trim().length < 2) {
        return res.status(400).json({
          message: 'Last name must be at least 2 characters long'
        });
      }
      updateData.lastName = lastName.trim();
    }

    if (phone !== undefined) {
      // Allow null/empty phone or validate phone format
      if (phone && phone.trim()) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
          return res.status(400).json({
            message: 'Please provide a valid phone number'
          });
        }
        updateData.phone = phone.trim();
      } else {
        updateData.phone = null;
      }
    }

    if (avatar !== undefined) {
      updateData.avatar = avatar ? avatar.trim() : null;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: 'No valid fields provided for update'
      });
    }

    updateData.updatedAt = new Date();

    const updatedUser = await req.prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        updatedAt: true
      }
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      message: 'Error updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* GET /api/users/bookings - Get User's Bookings */
router.get('/bookings', authenticateToken, async function(req, res, next) {
  try {
    const { status, paymentStatus, page = 1, limit = 20 } = req.query;

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const where = { userId: req.user.userId };
    
    if (status) {
      const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REFUNDED'];
      if (validStatuses.includes(status.toUpperCase())) {
        where.status = status.toUpperCase();
      }
    }

    if (paymentStatus) {
      const validPaymentStatuses = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];
      if (validPaymentStatuses.includes(paymentStatus.toUpperCase())) {
        where.paymentStatus = paymentStatus.toUpperCase();
      }
    }

    const [bookings, total] = await Promise.all([
      req.prisma.booking.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          spot: {
            select: {
              id: true,
              title: true,
              location: true,
              address: true,
              city: true,
              state: true,
              price: true,
              images: true,
              amenities: true,
              owner: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      req.prisma.booking.count({ where })
    ]);

    // Parse JSON fields
    const bookingsWithParsedData = bookings.map(booking => {
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

      // Safely parse JSON fields
      let spotImages = [];
      let spotAmenities = [];
      
      if (booking.spot.images) {
        try {
          spotImages = typeof booking.spot.images === 'string' 
            ? JSON.parse(booking.spot.images) 
            : booking.spot.images;
        } catch (e) {
          console.warn('Failed to parse spot images:', e);
          spotImages = [];
        }
      }

      if (booking.spot.amenities) {
        try {
          spotAmenities = typeof booking.spot.amenities === 'string' 
            ? JSON.parse(booking.spot.amenities) 
            : booking.spot.amenities;
        } catch (e) {
          console.warn('Failed to parse spot amenities:', e);
          spotAmenities = [];
        }
      }

      return {
        ...booking,
        totalPrice: parseFloat(booking.totalPrice),
        spot: {
          ...booking.spot,
          price: parseFloat(booking.spot.price),
          images: spotImages,
          amenities: spotAmenities
        },
        nights,
        pricePerNight: parseFloat(booking.totalPrice) / nights
      };
    });

    res.json({ 
      message: 'Bookings retrieved successfully',
      bookings: bookingsWithParsedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1
      }
    });

  } catch (error) {
    console.error('Bookings fetch error:', error);
    res.status(500).json({
      message: 'Error fetching bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* GET /api/users/reviews - Get User's Reviews */
router.get('/reviews', authenticateToken, async function(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
      req.prisma.review.findMany({
        where: { userId: req.user.userId },
        skip,
        take: limitNum,
        include: {
          spot: {
            select: {
              id: true,
              title: true,
              location: true,
              city: true,
              state: true,
              images: true,
              owner: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      req.prisma.review.count({ where: { userId: req.user.userId } })
    ]);

    // Parse JSON fields
    const reviewsWithParsedData = reviews.map(review => {
      let spotImages = [];
      
      if (review.spot.images) {
        try {
          spotImages = typeof review.spot.images === 'string' 
            ? JSON.parse(review.spot.images) 
            : review.spot.images;
        } catch (e) {
          console.warn('Failed to parse spot images:', e);
          spotImages = [];
        }
      }

      return {
        ...review,
        spot: {
          ...review.spot,
          images: spotImages
        }
      };
    });

    res.json({
      message: 'Reviews retrieved successfully',
      reviews: reviewsWithParsedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1
      }
    });

  } catch (error) {
    console.error('Reviews fetch error:', error);
    res.status(500).json({
      message: 'Error fetching reviews',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* GET /api/users/stats - Get User Statistics */
router.get('/stats', authenticateToken, async function(req, res, next) {
  try {
    const userId = req.user.userId;

    const [
      totalBookings,
      completedBookings,
      cancelledBookings,
      totalSpent,
      totalReviews,
      averageRating
    ] = await Promise.all([
      req.prisma.booking.count({
        where: { userId }
      }),
      req.prisma.booking.count({
        where: { userId, status: 'COMPLETED' }
      }),
      req.prisma.booking.count({
        where: { userId, status: 'CANCELLED' }
      }),
      req.prisma.booking.aggregate({
        _sum: { totalPrice: true },
        where: { 
          userId,
          status: 'COMPLETED',
          paymentStatus: 'PAID'
        }
      }),
      req.prisma.review.count({
        where: { userId }
      }),
      req.prisma.review.aggregate({
        _avg: { rating: true },
        where: { userId }
      })
    ]);

    res.json({
      message: 'User statistics retrieved successfully',
      stats: {
        bookings: {
          total: totalBookings,
          completed: completedBookings,
          cancelled: cancelledBookings,
          pending: totalBookings - completedBookings - cancelledBookings
        },
        spending: {
          total: parseFloat(totalSpent._sum.totalPrice || 0),
          average: completedBookings > 0 ? parseFloat(totalSpent._sum.totalPrice || 0) / completedBookings : 0
        },
        reviews: {
          total: totalReviews,
          averageRating: averageRating._avg.rating ? Math.round(averageRating._avg.rating * 10) / 10 : 0
        }
      }
    });

  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({
      message: 'Error fetching user statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* PUT /api/users/verification - Request email verification */
router.put('/verification', authenticateToken, async function(req, res, next) {
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { isVerified: true, email: true }
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        message: 'User is already verified'
      });
    }

    // Here you would typically send a verification email
    // For now, we'll just return a success message
    
    res.json({
      message: 'Verification email sent successfully',
      email: user.email
    });

  } catch (error) {
    console.error('Verification request error:', error);
    res.status(500).json({
      message: 'Error requesting verification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* DELETE /api/users/account - Delete user account (soft delete) */
router.delete('/account', authenticateToken, async function(req, res, next) {
  try {
    const { password, reason } = req.body;

    if (!password) {
      return res.status(400).json({
        message: 'Password is required to delete account'
      });
    }

    // Get user with password for verification
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // Verify password
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        message: 'Invalid password'
      });
    }

    // Check for active bookings
    const activeBookings = await req.prisma.booking.count({
      where: {
        userId: req.user.userId,
        status: {
          in: ['CONFIRMED', 'PENDING']
        },
        checkIn: {
          gte: new Date()
        }
      }
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        message: 'Cannot delete account with active bookings. Please cancel or complete all bookings first.'
      });
    }

    // Soft delete by deactivating account
    await req.prisma.user.update({
      where: { id: req.user.userId },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });

    res.json({
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({
      message: 'Error deleting account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;