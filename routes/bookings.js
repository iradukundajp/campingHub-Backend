var express = require('express');
var router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all booking routes
router.use(authenticateToken);

/* POST /api/bookings - Create a new booking */
router.post('/', async function(req, res, next) {
  try {
    const { spotId, checkIn, checkOut, guests, notes } = req.body;

    // Validation
    if (!spotId || !checkIn || !checkOut || !guests) {
      return res.status(400).json({
        message: 'All required fields must be provided: spotId, checkIn, checkOut, guests'
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Date validations
    if (checkInDate < today) {
      return res.status(400).json({
        message: 'Check-in date cannot be in the past'
      });
    }

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({
        message: 'Check-out date must be after check-in date'
      });
    }

    // Check booking duration (max 30 days)
    const daysDiff = (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24);
    if (daysDiff > 30) {
      return res.status(400).json({
        message: 'Maximum booking duration is 30 days'
      });
    }

    if (guests <= 0 || guests > 50) {
      return res.status(400).json({
        message: 'Number of guests must be between 1 and 50'
      });
    }

    // Check if camping spot exists and is active
    const spot = await req.prisma.campingSpot.findUnique({
      where: { id: parseInt(spotId) },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!spot) {
      return res.status(404).json({
        message: 'Camping spot not found'
      });
    }

    if (!spot.isActive) {
      return res.status(400).json({
        message: 'This camping spot is not available for booking'
      });
    }

    if (guests > spot.capacity) {
      return res.status(400).json({
        message: `Maximum capacity for this spot is ${spot.capacity} guests`
      });
    }

    // Prevent users from booking their own spots
    if (spot.ownerId === req.user.userId) {
      return res.status(400).json({
        message: 'You cannot book your own camping spot'
      });
    }

    // Check for conflicting bookings
    const conflictingBookings = await req.prisma.booking.findMany({
      where: {
        spotId: parseInt(spotId),
        status: {
          in: ['CONFIRMED', 'PENDING']
        },
        OR: [
          {
            AND: [
              { checkIn: { lte: checkInDate } },
              { checkOut: { gt: checkInDate } }
            ]
          },
          {
            AND: [
              { checkIn: { lt: checkOutDate } },
              { checkOut: { gte: checkOutDate } }
            ]
          },
          {
            AND: [
              { checkIn: { gte: checkInDate } },
              { checkOut: { lte: checkOutDate } }
            ]
          }
        ]
      }
    });

    if (conflictingBookings.length > 0) {
      return res.status(409).json({
        message: 'The selected dates are not available. Please choose different dates.'
      });
    }

    // Calculate total price
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const totalPrice = nights * parseFloat(spot.price);

    // Create booking
    const booking = await req.prisma.booking.create({
      data: {
        userId: req.user.userId,
        spotId: parseInt(spotId),
        checkIn: checkInDate,
        checkOut: checkOutDate,
        guests: parseInt(guests),
        totalPrice: totalPrice,
        status: 'CONFIRMED',
        notes: notes?.trim() || null
      },
      include: {
        spot: {
          select: {
            id: true,
            title: true,
            location: true,
            price: true,
            images: true
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Booking created successfully',
      booking: {
        ...booking,
        spot: {
          ...booking.spot,
          images: booking.spot.images ? JSON.parse(booking.spot.images) : []
        },
        nights,
        pricePerNight: parseFloat(spot.price)
      }
    });

  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      message: 'Error creating booking'
    });
  }
});

/* GET /api/bookings - Get user's bookings */
router.get('/', async function(req, res, next) {
  try {
    const { status } = req.query;

    // Build where clause
    const where = { userId: req.user.userId };
    if (status) {
      const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];
      if (validStatuses.includes(status.toUpperCase())) {
        where.status = status.toUpperCase();
      }
    }

    const bookings = await req.prisma.booking.findMany({
      where,
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

    // Parse JSON fields and add computed fields
    const bookingsWithExtras = bookings.map(booking => {
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      
      return {
        ...booking,
        spot: {
          ...booking.spot,
          images: booking.spot.images ? JSON.parse(booking.spot.images) : []
        },
        nights,
        pricePerNight: booking.totalPrice / nights,
        canCancel: canCancelBooking(booking)
      };
    });

    res.json({
      message: 'Bookings retrieved successfully',
      bookings: bookingsWithExtras
    });

  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      message: 'Error fetching bookings'
    });
  }
});

/* GET /api/bookings/:id - Get single booking */
router.get('/:id', async function(req, res, next) {
  try {
    const bookingId = parseInt(req.params.id);
    
    if (isNaN(bookingId)) {
      return res.status(400).json({
        message: 'Invalid booking ID'
      });
    }
    
    const booking = await req.prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId: req.user.userId
      },
      include: {
        spot: {
          include: {
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
    });

    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found'
      });
    }

    // Parse JSON fields and add computed data
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    const enrichedBooking = {
      ...booking,
      spot: {
        ...booking.spot,
        images: booking.spot.images ? JSON.parse(booking.spot.images) : [],
        amenities: booking.spot.amenities ? JSON.parse(booking.spot.amenities) : []
      },
      nights,
      pricePerNight: booking.totalPrice / nights,
      canCancel: canCancelBooking(booking)
    };

    res.json({ 
      message: 'Booking retrieved successfully',
      booking: enrichedBooking 
    });

  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      message: 'Error fetching booking'
    });
  }
});

/* PUT /api/bookings/:id/cancel - Cancel a booking */
router.put('/:id/cancel', async function(req, res, next) {
  try {
    const bookingId = parseInt(req.params.id);
    const { reason } = req.body;
    
    if (isNaN(bookingId)) {
      return res.status(400).json({
        message: 'Invalid booking ID'
      });
    }
    
    const booking = await req.prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId: req.user.userId
      }
    });

    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found'
      });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({
        message: 'Booking is already cancelled'
      });
    }

    if (booking.status === 'COMPLETED') {
      return res.status(400).json({
        message: 'Cannot cancel a completed booking'
      });
    }

    // Check if booking can still be cancelled
    if (!canCancelBooking(booking)) {
      return res.status(400).json({
        message: 'Bookings can only be cancelled at least 24 hours before check-in'
      });
    }

    const updatedBooking = await req.prisma.booking.update({
      where: { id: bookingId },
      data: { 
        status: 'CANCELLED',
        notes: reason ? `Cancelled: ${reason}` : booking.notes,
        updatedAt: new Date()
      }
    });

    res.json({
      message: 'Booking cancelled successfully',
      booking: updatedBooking
    });

  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      message: 'Error cancelling booking'
    });
  }
});

/* POST /api/bookings/:id/review - Add a review for a completed booking */
router.post('/:id/review', async function(req, res, next) {
  try {
    const bookingId = parseInt(req.params.id);
    const { rating, comment } = req.body;

    if (isNaN(bookingId)) {
      return res.status(400).json({
        message: 'Invalid booking ID'
      });
    }

    // Validate rating
    if (!rating || rating < 1 || rating > 5 || !Number.isInteger(Number(rating))) {
      return res.status(400).json({
        message: 'Rating is required and must be an integer between 1 and 5'
      });
    }

    const booking = await req.prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId: req.user.userId
      }
    });

    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'COMPLETED') {
      return res.status(400).json({
        message: 'Reviews can only be added for completed bookings'
      });
    }

    // Check if review already exists
    const existingReview = await req.prisma.review.findFirst({
      where: {
        userId: req.user.userId,
        spotId: booking.spotId
      }
    });

    if (existingReview) {
      return res.status(409).json({
        message: 'You have already reviewed this camping spot'
      });
    }

    // Create review
    const review = await req.prisma.review.create({
      data: {
        userId: req.user.userId,
        spotId: booking.spotId,
        rating: parseInt(rating),
        comment: comment?.trim() || null,
        isVerified: true
      }
    });

    res.status(201).json({
      message: 'Review added successfully',
      review
    });

  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      message: 'Error adding review'
    });
  }
});

// Helper function to check if booking can be cancelled
function canCancelBooking(booking, hoursBeforeCheckIn = 24) {
  const checkInDate = new Date(booking.checkIn);
  const now = new Date();
  const hoursUntilCheckIn = (checkInDate - now) / (1000 * 60 * 60);
  
  return hoursUntilCheckIn >= hoursBeforeCheckIn && 
         !['CANCELLED', 'COMPLETED'].includes(booking.status);
}

module.exports = router;