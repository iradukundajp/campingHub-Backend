var express = require('express');
var router = express.Router();

/* GET API home page */
router.get('/', function(req, res, next) {
  res.json({ 
    message: 'CampingHub API is running!',
    version: '1.0.0',
    endpoints: {
      auth: '/api/users',
      spots: '/api/spots',
      bookings: '/api/bookings'
    }
  });
});

/* Test database connection */
router.get('/test-db', async function(req, res, next) {
  try {
    // Simple database query to test connection
    const userCount = await req.prisma.user.count();
    const spotCount = await req.prisma.campingSpot.count();
    const bookingCount = await req.prisma.booking.count();
    
    res.json({
      message: 'Database connection successful!',
      stats: {
        users: userCount,
        campingSpots: spotCount,
        bookings: bookingCount
      }
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      message: 'Database connection failed',
      error: error.message
    });
  }
});

/* GET all camping spots with search and filter */
router.get('/spots', async function(req, res, next) {
  try {
    const { search, location, minPrice, maxPrice, capacity } = req.query;
    
    // Build filter object
    const where = {
      isActive: true
    };

    // Add search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Add location filter
    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    // Add price filters
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }

    // Add capacity filter
    if (capacity) {
      where.capacity = { gte: parseInt(capacity) };
    }

    const spots = await req.prisma.campingSpot.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        reviews: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        _count: {
          select: {
            bookings: true,
            reviews: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate average rating for each spot
    const spotsWithRating = spots.map(spot => {
      const avgRating = spot.reviews.length > 0 
        ? spot.reviews.reduce((sum, review) => sum + review.rating, 0) / spot.reviews.length
        : 0;
      
      return {
        ...spot,
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews: spot.reviews.length,
        totalBookings: spot._count.bookings
      };
    });
    
    res.json({
      spots: spotsWithRating,
      total: spotsWithRating.length
    });
  } catch (error) {
    console.error('Error fetching spots:', error);
    res.status(500).json({
      message: 'Error fetching camping spots',
      error: error.message
    });
  }
});

/* GET single camping spot by ID */
router.get('/spots/:id', async function(req, res, next) {
  try {
    const spotId = parseInt(req.params.id);
    
    const spot = await req.prisma.campingSpot.findUnique({
      where: { id: spotId },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        reviews: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        bookings: {
          where: {
            status: 'CONFIRMED'
          },
          select: {
            checkIn: true,
            checkOut: true
          }
        }
      }
    });

    if (!spot) {
      return res.status(404).json({
        message: 'Camping spot not found'
      });
    }

    // Calculate average rating
    const avgRating = spot.reviews.length > 0 
      ? spot.reviews.reduce((sum, review) => sum + review.rating, 0) / spot.reviews.length
      : 0;

    res.json({
      ...spot,
      averageRating: Math.round(avgRating * 10) / 10,
      totalReviews: spot.reviews.length
    });
  } catch (error) {
    console.error('Error fetching spot:', error);
    res.status(500).json({
      message: 'Error fetching camping spot',
      error: error.message
    });
  }
});

module.exports = router;