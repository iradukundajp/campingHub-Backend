var express = require('express');
var router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Middleware to check if user is an admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ 
      message: 'Access denied. Admin privileges required.' 
    });
  }
  next();
};

// Apply authentication and admin check to all admin routes
router.use(authenticateToken);
router.use(requireAdmin);

/* GET /api/admin/dashboard - Admin Dashboard Stats */
router.get('/dashboard', async function(req, res, next) {
  try {
    // Get overview statistics
    const [
      userCount, 
      ownerCount, 
      adminCount,
      spotCount, 
      activeSpotCount, 
      bookingCount,
      pendingBookings,
      confirmedBookings,
      totalRevenue,
      pendingPayments,
      paidPayments
    ] = await Promise.all([
      req.prisma.user.count({ where: { role: 'USER' } }),
      req.prisma.user.count({ where: { role: 'OWNER' } }),
      req.prisma.user.count({ where: { role: 'ADMIN' } }),
      req.prisma.campingSpot.count(),
      req.prisma.campingSpot.count({ where: { isActive: true } }),
      req.prisma.booking.count(),
      req.prisma.booking.count({ where: { status: 'PENDING' } }),
      req.prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      req.prisma.booking.aggregate({
        _sum: { totalPrice: true },
        where: { 
          status: 'CONFIRMED',
          paymentStatus: 'PAID'
        }
      }),
      req.prisma.booking.count({ where: { paymentStatus: 'PENDING' } }),
      req.prisma.booking.count({ where: { paymentStatus: 'PAID' } })
    ]);

    // Get recent users (last 5)
    const recentUsers = await req.prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        _count: {
          select: {
            bookings: true,
            ownedSpots: true
          }
        }
      }
    });

    // Get recent bookings (last 5)
    const recentBookings = await req.prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true }
        },
        spot: {
          select: { title: true, location: true, city: true, state: true }
        }
      }
    });

    // Get recent spots (last 5)
    const recentSpots = await req.prisma.campingSpot.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: { firstName: true, lastName: true }
        },
        _count: {
          select: { bookings: true, reviews: true }
        }
      }
    });

    // Format recent bookings with computed data
    const formattedRecentBookings = recentBookings.map(booking => ({
      ...booking,
      totalPrice: parseFloat(booking.totalPrice),
      nights: Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24))
    }));

    // Format recent spots with computed data
    const formattedRecentSpots = recentSpots.map(spot => ({
      ...spot,
      price: parseFloat(spot.price),
      images: spot.images ? JSON.parse(spot.images) : [],
      amenities: spot.amenities ? JSON.parse(spot.amenities) : []
    }));

    res.json({
      message: 'Dashboard data retrieved successfully',
      dashboard: {
        overview: {
          users: {
            total: userCount,
            regular: userCount,
            owners: ownerCount,
            admins: adminCount
          },
          spots: {
            total: spotCount,
            active: activeSpotCount,
            inactive: spotCount - activeSpotCount
          },
          bookings: {
            total: bookingCount,
            pending: pendingBookings,
            confirmed: confirmedBookings
          },
          revenue: {
            total: parseFloat(totalRevenue._sum.totalPrice || 0),
            pendingPayments: pendingPayments,
            paidPayments: paidPayments
          }
        },
        recentActivity: {
          recentUsers,
          recentBookings: formattedRecentBookings,
          recentSpots: formattedRecentSpots
        }
      }
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      message: 'Error fetching dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* GET /api/admin/users - Get all users with search and pagination */
router.get('/users', async function(req, res, next) {
  try {
    const { 
      search, 
      role, 
      isActive,
      isVerified,
      page = 1, 
      limit = 20 
    } = req.query;

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const where = {};
    
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role && ['USER', 'OWNER', 'ADMIN'].includes(role.toUpperCase())) {
      where.role = role.toUpperCase();
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (isVerified !== undefined) {
      where.isVerified = isVerified === 'true';
    }

    const [users, total] = await Promise.all([
      req.prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
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
      }),
      req.prisma.user.count({ where })
    ]);

    res.json({
      message: 'Users retrieved successfully',
      users,
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
    console.error('Admin users fetch error:', error);
    res.status(500).json({
      message: 'Error fetching users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* PUT /api/admin/users/:id - Update user status/role */
router.put('/users/:id', async function(req, res, next) {
  try {
    const userId = parseInt(req.params.id);
    const { isActive, role, isVerified } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({
        message: 'Invalid user ID'
      });
    }

    // Check if user exists
    const existingUser = await req.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // Prevent admin from deactivating themselves
    if (userId === req.user.userId && isActive === false) {
      return res.status(400).json({
        message: 'You cannot deactivate your own account'
      });
    }

    // Prevent admin from removing their own admin role
    if (userId === req.user.userId && role && role !== 'ADMIN') {
      return res.status(400).json({
        message: 'You cannot change your own admin role'
      });
    }

    // Build update data
    const updateData = {};
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (isVerified !== undefined) updateData.isVerified = Boolean(isVerified);
    
    if (role !== undefined) {
      const validRoles = ['USER', 'OWNER', 'ADMIN'];
      if (!validRoles.includes(role.toUpperCase())) {
        return res.status(400).json({
          message: 'Invalid role. Must be USER, OWNER, or ADMIN'
        });
      }
      updateData.role = role.toUpperCase();
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: 'No valid fields provided for update'
      });
    }

    updateData.updatedAt = new Date();

    const updatedUser = await req.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        isVerified: true,
        updatedAt: true
      }
    });

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Admin user update error:', error);
    res.status(500).json({
      message: 'Error updating user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* GET /api/admin/spots - Get all camping spots */
router.get('/spots', async function(req, res, next) {
  try {
    const { 
      search, 
      isActive,
      city,
      state,
      page = 1, 
      limit = 20 
    } = req.query;

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const where = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { state: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    if (state) {
      where.state = { contains: state, mode: 'insensitive' };
    }

    const [spots, total] = await Promise.all([
      req.prisma.campingSpot.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true
            }
          },
          _count: {
            select: {
              bookings: true,
              reviews: true
            }
          }
        }
      }),
      req.prisma.campingSpot.count({ where })
    ]);

    // Process spots
    const processedSpots = spots.map(spot => ({
      ...spot,
      price: parseFloat(spot.price),
      images: spot.images ? JSON.parse(spot.images) : [],
      amenities: spot.amenities ? JSON.parse(spot.amenities) : [],
      totalBookings: spot._count.bookings,
      totalReviews: spot._count.reviews
    }));

    res.json({
      message: 'Camping spots retrieved successfully',
      spots: processedSpots,
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
    console.error('Admin spots fetch error:', error);
    res.status(500).json({
      message: 'Error fetching camping spots',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* PUT /api/admin/spots/:id - Update spot status */
router.put('/spots/:id', async function(req, res, next) {
  try {
    const spotId = parseInt(req.params.id);
    const { isActive } = req.body;

    if (isNaN(spotId)) {
      return res.status(400).json({
        message: 'Invalid spot ID'
      });
    }

    // Check if spot exists
    const existingSpot = await req.prisma.campingSpot.findUnique({
      where: { id: spotId }
    });

    if (!existingSpot) {
      return res.status(404).json({
        message: 'Camping spot not found'
      });
    }

    const updatedSpot = await req.prisma.campingSpot.update({
      where: { id: spotId },
      data: { 
        isActive: Boolean(isActive),
        updatedAt: new Date()
      },
      include: {
        owner: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json({
      message: 'Camping spot updated successfully',
      spot: {
        ...updatedSpot,
        price: parseFloat(updatedSpot.price),
        images: updatedSpot.images ? JSON.parse(updatedSpot.images) : [],
        amenities: updatedSpot.amenities ? JSON.parse(updatedSpot.amenities) : []
      }
    });

  } catch (error) {
    console.error('Admin spot update error:', error);
    res.status(500).json({
      message: 'Error updating camping spot',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* GET /api/admin/bookings - Get all bookings */
router.get('/bookings', async function(req, res, next) {
  try {
    const { 
      status,
      paymentStatus,
      page = 1, 
      limit = 20 
    } = req.query;

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const where = {};
    
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
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true
            }
          },
          spot: {
            select: {
              id: true,
              title: true,
              location: true,
              city: true,
              state: true,
              price: true,
              owner: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        }
      }),
      req.prisma.booking.count({ where })
    ]);

    // Process bookings with computed data
    const processedBookings = bookings.map(booking => {
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      
      return {
        ...booking,
        totalPrice: parseFloat(booking.totalPrice),
        spot: {
          ...booking.spot,
          price: parseFloat(booking.spot.price)
        },
        nights,
        pricePerNight: parseFloat(booking.totalPrice) / nights
      };
    });

    res.json({
      message: 'Bookings retrieved successfully',
      bookings: processedBookings,
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
    console.error('Admin bookings fetch error:', error);
    res.status(500).json({
      message: 'Error fetching bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* PUT /api/admin/bookings/:id - Update booking status */
router.put('/bookings/:id', async function(req, res, next) {
  try {
    const bookingId = parseInt(req.params.id);
    const { status, paymentStatus, notes } = req.body;

    if (isNaN(bookingId)) {
      return res.status(400).json({
        message: 'Invalid booking ID'
      });
    }

    // Check if booking exists
    const existingBooking = await req.prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!existingBooking) {
      return res.status(404).json({
        message: 'Booking not found'
      });
    }

    // Build update data
    const updateData = {};
    
    if (status !== undefined) {
      const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REFUNDED'];
      if (!validStatuses.includes(status.toUpperCase())) {
        return res.status(400).json({
          message: 'Invalid status. Must be PENDING, CONFIRMED, CANCELLED, COMPLETED, or REFUNDED'
        });
      }
      updateData.status = status.toUpperCase();
    }

    if (paymentStatus !== undefined) {
      const validPaymentStatuses = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];
      if (!validPaymentStatuses.includes(paymentStatus.toUpperCase())) {
        return res.status(400).json({
          message: 'Invalid payment status. Must be PENDING, PAID, FAILED, or REFUNDED'
        });
      }
      updateData.paymentStatus = paymentStatus.toUpperCase();
    }

    if (notes !== undefined) {
      updateData.notes = notes ? notes.trim() : null;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: 'No valid fields provided for update'
      });
    }

    updateData.updatedAt = new Date();

    const updatedBooking = await req.prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        spot: {
          select: {
            title: true,
            location: true
          }
        }
      }
    });

    res.json({
      message: 'Booking updated successfully',
      booking: {
        ...updatedBooking,
        totalPrice: parseFloat(updatedBooking.totalPrice)
      }
    });

  } catch (error) {
    console.error('Admin booking update error:', error);
    res.status(500).json({
      message: 'Error updating booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* DELETE /api/admin/users/:id - Delete user (soft delete by deactivating) */
router.delete('/users/:id', async function(req, res, next) {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        message: 'Invalid user ID'
      });
    }

    // Prevent admin from deleting themselves
    if (userId === req.user.userId) {
      return res.status(400).json({
        message: 'You cannot delete your own account'
      });
    }

    // Check if user exists
    const existingUser = await req.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // Soft delete by deactivating the user
    await req.prisma.user.update({
      where: { id: userId },
      data: { 
        isActive: false,
        updatedAt: new Date()
      }
    });

    res.json({
      message: 'User deactivated successfully'
    });

  } catch (error) {
    console.error('Admin user delete error:', error);
    res.status(500).json({
      message: 'Error deleting user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* GET /api/admin/analytics - Get analytics data */
router.get('/analytics', async function(req, res, next) {
  try {
    const { period = '30days' } = req.query;
    
    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7days':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Get analytics data
    const [
      newUsers,
      newBookings,
      revenue,
      topSpots,
      bookingsByStatus,
      paymentsByStatus
    ] = await Promise.all([
      // New users in period
      req.prisma.user.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      
      // New bookings in period
      req.prisma.booking.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      
      // Revenue in period
      req.prisma.booking.aggregate({
        _sum: { totalPrice: true },
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          },
          paymentStatus: 'PAID'
        }
      }),
      
      // Top spots by bookings
      req.prisma.campingSpot.findMany({
        take: 10,
        include: {
          _count: {
            select: {
              bookings: {
                where: {
                  createdAt: {
                    gte: startDate,
                    lte: endDate
                  }
                }
              }
            }
          }
        },
        orderBy: {
          bookings: {
            _count: 'desc'
          }
        }
      }),
      
      // Bookings by status
      req.prisma.booking.groupBy({
        by: ['status'],
        _count: {
          status: true
        },
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      
      // Payments by status
      req.prisma.booking.groupBy({
        by: ['paymentStatus'],
        _count: {
          paymentStatus: true
        },
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      })
    ]);

    res.json({
      message: 'Analytics data retrieved successfully',
      analytics: {
        period,
        dateRange: {
          start: startDate,
          end: endDate
        },
        summary: {
          newUsers,
          newBookings,
          revenue: parseFloat(revenue._sum.totalPrice || 0)
        },
        topSpots: topSpots.map(spot => ({
          id: spot.id,
          title: spot.title,
          location: spot.location,
          bookingCount: spot._count.bookings,
          price: parseFloat(spot.price)
        })),
        bookingsByStatus,
        paymentsByStatus
      }
    });

  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(500).json({
      message: 'Error fetching analytics data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;