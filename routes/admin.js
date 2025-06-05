var express = require('express');
var router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateSearchParams } = require('../middleware/validation');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/helpers');
const { logger } = require('../middleware/logger');

// Apply authentication and admin check to all routes
router.use(authenticateToken);
router.use(requireAdmin);

/* GET /api/admin/dashboard - Admin dashboard statistics */
router.get('/dashboard', async function(req, res, next) {
  try {
    // Get various statistics
    const [
      totalUsers,
      totalOwners,
      totalSpots,
      activeSpots,
      totalBookings,
      totalRevenue,
      recentUsers,
      recentBookings
    ] = await Promise.all([
      req.prisma.user.count({ where: { role: 'USER' } }),
      req.prisma.user.count({ where: { role: 'OWNER' } }),
      req.prisma.campingSpot.count(),
      req.prisma.campingSpot.count({ where: { isActive: true } }),
      req.prisma.booking.count(),
      req.prisma.booking.aggregate({
        _sum: { totalPrice: true },
        where: { status: 'COMPLETED' }
      }),
      req.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          createdAt: true
        }
      }),
      req.prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
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
      })
    ]);

    // Calculate monthly statistics for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyStats = await req.prisma.booking.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: sixMonthsAgo
        }
      },
      _count: {
        id: true
      },
      _sum: {
        totalPrice: true
      }
    });

    const dashboard = {
      overview: {
        totalUsers,
        totalOwners,
        totalSpots,
        activeSpots,
        totalBookings,
        totalRevenue: totalRevenue._sum.totalPrice || 0
      },
      recentActivity: {
        recentUsers,
        recentBookings
      },
      monthlyStats
    };

    logger.info('Admin dashboard accessed', { adminId: req.user.userId });

    res.json({
      message: 'Dashboard data retrieved successfully',
      dashboard
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
});

/* GET /api/admin/users - Get all users with pagination and search */
router.get('/users', validateSearchParams, async function(req, res, next) {
  try {
    const { search, role, page = 1, limit = 20 } = req.query;
    const { skip, take } = getPaginationParams(page, limit);

    // Build where clause
    const where = {};
    
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role) {
      where.role = role.toUpperCase();
    }

    const [users, total] = await Promise.all([
      req.prisma.user.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: {
              ownedSpots: true,
              bookings: true,
              reviews: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      req.prisma.user.count({ where })
    ]);

    res.json(formatPaginatedResponse(users, total, page, limit));

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      message: 'Error fetching users',
      error: error.message
    });
  }
});

/* PUT /api/admin/users/:id - Update user status or role */
router.put('/users/:id', async function(req, res, next) {
  try {
    const userId = parseInt(req.params.id);
    const { isActive, role, isVerified } = req.body;

    const updateData = {};
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (role !== undefined) updateData.role = role.toUpperCase();
    if (isVerified !== undefined) updateData.isVerified = Boolean(isVerified);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: 'No valid fields provided for update'
      });
    }

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
        isVerified: true
      }
    });

    logger.info('User updated by admin', {
      adminId: req.user.userId,
      updatedUserId: userId,
      changes: updateData
    });

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      message: 'Error updating user',
      error: error.message
    });
  }
});

/* GET /api/admin/spots - Get all camping spots */
router.get('/spots', validateSearchParams, async function(req, res, next) {
  try {
    const { search, location, page = 1, limit = 20 } = req.query;
    const { skip, take } = getPaginationParams(page, limit);

    const where = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    const [spots, total] = await Promise.all([
      req.prisma.campingSpot.findMany({
        where,
        skip,
        take,
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
        },
        orderBy: { createdAt: 'desc' }
      }),
      req.prisma.campingSpot.count({ where })
    ]);

    res.json(formatPaginatedResponse(spots, total, page, limit));

  } catch (error) {
    console.error('Error fetching spots:', error);
    res.status(500).json({
      message: 'Error fetching camping spots',
      error: error.message
    });
  }
});

/* PUT /api/admin/spots/:id - Update camping spot status */
router.put('/spots/:id', async function(req, res, next) {
  try {
    const spotId = parseInt(req.params.id);
    const { isActive } = req.body;

    if (isActive === undefined) {
      return res.status(400).json({
        message: 'isActive field is required'
      });
    }

    const updatedSpot = await req.prisma.campingSpot.update({
      where: { id: spotId },
      data: { isActive: Boolean(isActive) },
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

    logger.info('Camping spot status updated by admin', {
      adminId: req.user.userId,
      spotId: spotId,
      newStatus: isActive
    });

    res.json({
      message: 'Camping spot updated successfully',
      spot: updatedSpot
    });

  } catch (error) {
    console.error('Error updating camping spot:', error);
    res.status(500).json({
      message: 'Error updating camping spot',
      error: error.message
    });
  }
});

/* GET /api/admin/bookings - Get all bookings */
router.get('/bookings', validateSearchParams, async function(req, res, next) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const { skip, take } = getPaginationParams(page, limit);

    const where = {};
    if (status) {
      where.status = status.toUpperCase();
    }

    const [bookings, total] = await Promise.all([
      req.prisma.booking.findMany({
        where,
        skip,
        take,
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
              owner: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      req.prisma.booking.count({ where })
    ]);

    res.json(formatPaginatedResponse(bookings, total, page, limit));

  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      message: 'Error fetching bookings',
      error: error.message
    });
  }
});

/* GET /api/admin/reports - Generate various reports */
router.get('/reports', async function(req, res, next) {
  try {
    const { type, startDate, endDate } = req.query;

    let where = {};
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    let report = {};

    switch (type) {
      case 'revenue':
        const revenueData = await req.prisma.booking.groupBy({
          by: ['status'],
          where: {
            ...where,
            status: 'COMPLETED'
          },
          _sum: {
            totalPrice: true
          },
          _count: {
            id: true
          }
        });
        report = { type: 'revenue', data: revenueData };
        break;

      case 'users':
        const userGrowth = await req.prisma.user.groupBy({
          by: ['role'],
          where,
          _count: {
            id: true
          }
        });
        report = { type: 'users', data: userGrowth };
        break;

      case 'bookings':
        const bookingStats = await req.prisma.booking.groupBy({
          by: ['status'],
          where,
          _count: {
            id: true
          }
        });
        report = { type: 'bookings', data: bookingStats };
        break;

      default:
        return res.status(400).json({
          message: 'Invalid report type. Available types: revenue, users, bookings'
        });
    }

    logger.info('Report generated by admin', {
      adminId: req.user.userId,
      reportType: type,
      dateRange: { startDate, endDate }
    });

    res.json({
      message: 'Report generated successfully',
      report
    });

  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      message: 'Error generating report',
      error: error.message
    });
  }
});

/* DELETE /api/admin/users/:id - Delete user (soft delete) */
router.delete('/users/:id', async function(req, res, next) {
  try {
    const userId = parseInt(req.params.id);

    // Check if user has active bookings
    const activeBookings = await req.prisma.booking.count({
      where: {
        userId: userId,
        status: 'CONFIRMED',
        checkIn: {
          gte: new Date()
        }
      }
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        message: 'Cannot delete user with active bookings'
      });
    }

    // Soft delete by deactivating the user
    await req.prisma.user.update({
      where: { id: userId },
      data: { isActive: false }
    });

    logger.warn('User deleted by admin', {
      adminId: req.user.userId,
      deletedUserId: userId
    });

    res.json({
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      message: 'Error deleting user',
      error: error.message
    });
  }
});

module.exports = router;