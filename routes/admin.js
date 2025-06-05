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
    const [userCount, ownerCount, spotCount, activeSpotCount, bookingCount, totalRevenue] = await Promise.all([
      req.prisma.user.count({ where: { role: 'USER' } }),
      req.prisma.user.count({ where: { role: 'OWNER' } }),
      req.prisma.campingSpot.count(),
      req.prisma.campingSpot.count({ where: { isActive: true } }),
      req.prisma.booking.count(),
      req.prisma.booking.aggregate({
        _sum: { totalPrice: true },
        where: { status: 'CONFIRMED' }
      })
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
        createdAt: true
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
          select: { title: true, location: true }
        }
      }
    });

    res.json({
      message: 'Dashboard data retrieved successfully',
      dashboard: {
        overview: {
          totalUsers: userCount,
          totalOwners: ownerCount,
          totalSpots: spotCount,
          activeSpots: activeSpotCount,
          totalBookings: bookingCount,
          totalRevenue: totalRevenue._sum.totalPrice || 0
        },
        recentActivity: {
          recentUsers,
          recentBookings
        }
      }
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      message: 'Error fetching dashboard data'
    });
  }
});

/* GET /api/admin/users - Get all users with search and pagination */
router.get('/users', async function(req, res, next) {
  try {
    const { 
      search, 
      role, 
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
        { lastName: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role && ['USER', 'OWNER', 'ADMIN'].includes(role.toUpperCase())) {
      where.role = role.toUpperCase();
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
          role: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
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
      message: 'Error fetching users'
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
      message: 'Error updating user'
    });
  }
});

/* GET /api/admin/spots - Get all camping spots */
router.get('/spots', async function(req, res, next) {
  try {
    const { 
      search, 
      isActive,
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
        { location: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
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
              email: true
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
      message: 'Error fetching camping spots'
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
        images: updatedSpot.images ? JSON.parse(updatedSpot.images) : [],
        amenities: updatedSpot.amenities ? JSON.parse(updatedSpot.amenities) : []
      }
    });

  } catch (error) {
    console.error('Admin spot update error:', error);
    res.status(500).json({
      message: 'Error updating camping spot'
    });
  }
});

/* GET /api/admin/bookings - Get all bookings */
router.get('/bookings', async function(req, res, next) {
  try {
    const { 
      status,
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
      const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];
      if (validStatuses.includes(status.toUpperCase())) {
        where.status = status.toUpperCase();
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
              email: true
            }
          },
          spot: {
            select: {
              id: true,
              title: true,
              location: true,
              price: true
            }
          }
        }
      }),
      req.prisma.booking.count({ where })
    ]);

    res.json({
      message: 'Bookings retrieved successfully',
      bookings,
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
      message: 'Error fetching bookings'
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
      message: 'Error deleting user'
    });
  }
});

module.exports = router;