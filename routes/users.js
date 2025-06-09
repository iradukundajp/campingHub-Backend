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
      bookings: 'GET /api/users/bookings (requires auth)'
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
        role: true,
        createdAt: true,
        _count: {
          select: {
            bookings: true,
            ownedSpots: true
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
      message: 'Error fetching profile'
    });
  }
});

/* GET /api/users/bookings - Get User's Bookings */
router.get('/bookings', authenticateToken, async function(req, res, next) {
  try {
    const bookings = await req.prisma.booking.findMany({
      where: { userId: req.user.userId },
      include: {
        spot: {
          select: {
            id: true,
            title: true,
            location: true,
            price: true,
            images: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Parse JSON fields
    const bookingsWithParsedData = bookings.map(booking => ({
      ...booking,
      totalPrice: parseFloat(booking.totalPrice),
      spot: {
        ...booking.spot,
        price: parseFloat(booking.spot.price),
        images: booking.spot.images ? 
          (typeof booking.spot.images === 'string' ? 
            JSON.parse(booking.spot.images) : booking.spot.images) : []
      }
    }));

    res.json({ 
      message: 'Bookings retrieved successfully',
      bookings: bookingsWithParsedData
    });

  } catch (error) {
    console.error('Bookings fetch error:', error);
    res.status(500).json({
      message: 'Error fetching bookings'
    });
  }
});

module.exports = router;