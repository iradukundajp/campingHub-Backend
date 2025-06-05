var express = require('express');
var router = express.Router();

// Helper functions
const parseJsonField = (field) => {
  if (!field) return null;
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch {
      return field;
    }
  }
  return field;
};

const calculateAverageRating = (reviews) => {
  if (!reviews || reviews.length === 0) return 0;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return Math.round((total / reviews.length) * 10) / 10;
};

/* GET API home page */
router.get('/', function(req, res, next) {
  res.json({ 
    message: 'CampingHub API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      spots: '/api/spots',
      users: '/api/users',
      bookings: '/api/bookings',
      owners: '/api/owners'
    }
  });
});

/* Test database connection */
router.get('/test-db', async function(req, res, next) {
  try {
    const [userCount, spotCount, bookingCount] = await Promise.all([
      req.prisma.user.count(),
      req.prisma.campingSpot.count(),
      req.prisma.booking.count()
    ]);
    
    res.json({
      message: 'Database connection successful!',
      timestamp: new Date().toISOString(),
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
    const { 
      search, 
      location, 
      minPrice, 
      maxPrice, 
      capacity,
      page = 1,
      limit = 12,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
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
      if (minPrice && !isNaN(parseFloat(minPrice))) {
        where.price.gte = parseFloat(minPrice);
      }
      if (maxPrice && !isNaN(parseFloat(maxPrice))) {
        where.price.lte = parseFloat(maxPrice);
      }
    }

    // Add capacity filter
    if (capacity && !isNaN(parseInt(capacity))) {
      where.capacity = { gte: parseInt(capacity) };
    }

    // Build orderBy clause
    let orderBy = { createdAt: 'desc' };
    const validSortFields = ['createdAt', 'price', 'title', 'capacity'];
    const validSortOrders = ['asc', 'desc'];
    
    if (validSortFields.includes(sortBy) && validSortOrders.includes(sortOrder.toLowerCase())) {
      orderBy = { [sortBy]: sortOrder.toLowerCase() };
    }

    const [spots, total] = await Promise.all([
      req.prisma.campingSpot.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          owner: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          reviews: {
            select: {
              rating: true
            }
          },
          _count: {
            select: {
              bookings: true,
              reviews: true
            }
          }
        },
        orderBy
      }),
      req.prisma.campingSpot.count({ where })
    ]);

    // Process spots with calculated fields
    const spotsWithRating = spots.map(spot => {
      const parsedAmenities = parseJsonField(spot.amenities);
      const parsedImages = parseJsonField(spot.images);
      const avgRating = calculateAverageRating(spot.reviews);
      
      return {
        ...spot,
        amenities: parsedAmenities || [],
        images: parsedImages || [],
        averageRating: avgRating,
        totalReviews: spot.reviews.length,
        totalBookings: spot._count.bookings
      };
    });
    
    res.json({
      message: 'Camping spots retrieved successfully',
      spots: spotsWithRating,
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
    console.error('Error fetching spots:', error);
    res.status(500).json({
      message: 'Error fetching camping spots'
    });
  }
});

/* GET single camping spot by ID */
router.get('/spots/:id', async function(req, res, next) {
  try {
    const spotId = parseInt(req.params.id);
    
    if (isNaN(spotId)) {
      return res.status(400).json({
        message: 'Invalid spot ID'
      });
    }
    
    const spot = await req.prisma.campingSpot.findUnique({
      where: { id: spotId },
      include: {
        owner: {
          select: {
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
            status: 'CONFIRMED',
            checkOut: {
              gte: new Date()
            }
          },
          select: {
            checkIn: true,
            checkOut: true
          }
        }
      }
    });

    if (!spot || !spot.isActive) {
      return res.status(404).json({
        message: 'Camping spot not found or not available'
      });
    }

    // Parse JSON fields
    const parsedAmenities = parseJsonField(spot.amenities);
    const parsedImages = parseJsonField(spot.images);
    const avgRating = calculateAverageRating(spot.reviews);

    // Get unavailable dates
    const unavailableDates = spot.bookings.map(booking => ({
      start: booking.checkIn,
      end: booking.checkOut
    }));

    const enrichedSpot = {
      ...spot,
      amenities: parsedAmenities || [],
      images: parsedImages || [],
      averageRating: avgRating,
      totalReviews: spot.reviews.length,
      unavailableDates
    };

    res.json({
      message: 'Camping spot retrieved successfully',
      spot: enrichedSpot
    });
  } catch (error) {
    console.error('Error fetching spot:', error);
    res.status(500).json({
      message: 'Error fetching camping spot'
    });
  }
});

/* GET spot availability */
router.get('/spots/:id/availability', async function(req, res, next) {
  try {
    const spotId = parseInt(req.params.id);
    const { startDate, endDate } = req.query;
    
    if (isNaN(spotId)) {
      return res.status(400).json({
        message: 'Invalid spot ID'
      });
    }

    // Check if spot exists and is active
    const spot = await req.prisma.campingSpot.findUnique({
      where: { id: spotId },
      select: { id: true, isActive: true, title: true }
    });

    if (!spot || !spot.isActive) {
      return res.status(404).json({
        message: 'Camping spot not found or not available'
      });
    }

    // Date range for availability check
    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date();
    
    // Default to next 30 days if no end date provided
    if (!endDate) {
      end.setDate(start.getDate() + 30);
    }

    // Get existing bookings in the date range
    const existingBookings = await req.prisma.booking.findMany({
      where: {
        spotId: spotId,
        status: {
          in: ['CONFIRMED', 'PENDING']
        },
        OR: [
          {
            checkIn: {
              gte: start,
              lte: end
            }
          },
          {
            checkOut: {
              gte: start,
              lte: end
            }
          },
          {
            AND: [
              { checkIn: { lte: start } },
              { checkOut: { gte: end } }
            ]
          }
        ]
      },
      select: {
        checkIn: true,
        checkOut: true
      }
    });

    res.json({
      message: 'Availability retrieved successfully',
      spotId: spotId,
      spotTitle: spot.title,
      dateRange: { start, end },
      unavailableDates: existingBookings.map(booking => ({
        start: booking.checkIn,
        end: booking.checkOut
      }))
    });

  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({
      message: 'Error fetching availability'
    });
  }
});

module.exports = router;