var express = require('express');
var router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all booking routes
router.use(authenticateToken);

/* POST /api/bookings - Create a new booking */
router.post('/', async function(req, res, next) {
  try {
    const { spotId, checkIn, checkOut, guests } = req.body;

    // Validation
    if (!spotId || !checkIn || !checkOut || !guests) {
      return res.status(400).json({
        message: 'Required fields: spotId, checkIn, checkOut, guests'
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

    if (guests <= 0) {
      return res.status(400).json({
        message: 'Number of guests must be greater than 0'
      });
    }

    // Check if camping spot exists and is active
    const spot = await req.prisma.campingSpot.findUnique({
      where: { id: parseInt(spotId) }
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

    // Check for conflicting bookings
    const conflictingBookings = await req.prisma.booking.findMany({
      where: {
        spotId: parseInt(spotId),
        status: 'CONFIRMED',
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
        message: 'The selected dates are not available'
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
        status: 'CONFIRMED' // In a real app, this might be PENDING until payment
      },
      include: {
        spot: {
          select: {
            id: true,
            title: true,
            location: true,
            price: true
          }
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Booking created successfully',
      booking
    });

  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      message: 'Error creating booking',
      error: error.message
    });
  }
});

/* GET /api/bookings - Get user's bookings */
router.get('/', async function(req, res, next) {
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

    res.json({
      bookings,
      total: bookings.length
    });

  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      message: 'Error fetching bookings',
      error: error.message
    });
  }
});

/* GET /api/bookings/:id - Get single booking */
router.get('/:id', async function(req, res, next) {
  try {
    const bookingId = parseInt(req.params.id);
    
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

    res.json({ booking });

  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      message: 'Error fetching booking',
      error: error.message
    });
  }
});

/* PUT /api/bookings/:id/cancel - Cancel a booking */
router.put('/:id/cancel', async function(req, res, next) {
  try {
    const bookingId = parseInt(req.params.id);
    
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

    // Check if booking can still be cancelled (e.g., not too close to check-in)
    const checkInDate = new Date(booking.checkIn);
    const now = new Date();
    const timeDiff = checkInDate - now;
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff < 24) { // 24 hours cancellation policy
      return res.status(400).json({
        message: 'Bookings can only be cancelled at least 24 hours before check-in'
      });
    }

    const updatedBooking = await req.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
      include: {
        spot: {
          select: {
            id: true,
            title: true,
            location: true
          }
        }
      }
    });

    res.json({
      message: 'Booking cancelled successfully',
      booking: updatedBooking
    });

  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      message: 'Error cancelling booking',
      error: error.message
    });
  }
});

/* POST /api/bookings/:id/review - Add a review for a completed booking */
router.post('/:id/review', async function(req, res, next) {
  try {
    const bookingId = parseInt(req.params.id);
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        message: 'Rating is required and must be between 1 and 5'
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

    const review = await req.prisma.review.create({
      data: {
        userId: req.user.userId,
        spotId: booking.spotId,
        rating: parseInt(rating),
        comment: comment || null
      },
      include: {
        spot: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Review added successfully',
      review
    });

  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      message: 'Error adding review',
      error: error.message
    });
  }
});

module.exports = router;