var express = require('express');
var router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all booking routes
router.use(authenticateToken);

/* POST /api/bookings - Create a new booking */
router.post('/', async function(req, res, next) {
  try {
    const { spotId, checkIn, checkOut, guests, notes, paymentMethod } = req.body;

    // Enhanced validation
    if (!spotId || !checkIn || !checkOut || !guests) {
      return res.status(400).json({
        message: 'All required fields must be provided: spotId, checkIn, checkOut, guests',
        provided: { spotId: !!spotId, checkIn: !!checkIn, checkOut: !!checkOut, guests: !!guests }
      });
    }

    // Parse and validate dates with better error handling
    let checkInDate, checkOutDate;
    try {
      checkInDate = new Date(checkIn);
      checkOutDate = new Date(checkOut);
      
      // Check if dates are valid
      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        return res.status(400).json({
          message: 'Invalid date format. Please use YYYY-MM-DD format.'
        });
      }
    } catch (error) {
      return res.status(400).json({
        message: 'Invalid date format. Please use YYYY-MM-DD format.'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Normalize check-in and check-out dates to avoid timezone issues
    checkInDate.setHours(0, 0, 0, 0);
    checkOutDate.setHours(0, 0, 0, 0);

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

    // Validate guests
    const guestCount = parseInt(guests);
    if (isNaN(guestCount) || guestCount <= 0 || guestCount > 50) {
      return res.status(400).json({
        message: 'Number of guests must be between 1 and 50'
      });
    }

    // Validate spotId
    const spotIdInt = parseInt(spotId);
    if (isNaN(spotIdInt)) {
      return res.status(400).json({
        message: 'Invalid spot ID'
      });
    }

    // Check if camping spot exists and is active
    const spot = await req.prisma.campingSpot.findUnique({
      where: { id: spotIdInt },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
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

    if (guestCount > spot.capacity) {
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

    // Enhanced conflict checking with better date handling
    const conflictingBookings = await req.prisma.booking.findMany({
      where: {
        spotId: spotIdInt,
        status: {
          in: ['CONFIRMED', 'PENDING']
        },
        OR: [
          // Existing booking starts before new booking and ends after new booking starts
          {
            AND: [
              { checkIn: { lt: checkInDate } },
              { checkOut: { gt: checkInDate } }
            ]
          },
          // Existing booking starts before new booking ends and ends after new booking ends
          {
            AND: [
              { checkIn: { lt: checkOutDate } },
              { checkOut: { gt: checkOutDate } }
            ]
          },
          // Existing booking is completely within new booking
          {
            AND: [
              { checkIn: { gte: checkInDate } },
              { checkOut: { lte: checkOutDate } }
            ]
          },
          // New booking is completely within existing booking
          {
            AND: [
              { checkIn: { lte: checkInDate } },
              { checkOut: { gte: checkOutDate } }
            ]
          }
        ]
      }
    });

    if (conflictingBookings.length > 0) {
      return res.status(409).json({
        message: 'The selected dates are not available. Please choose different dates.',
        conflictingDates: conflictingBookings.map(booking => ({
          checkIn: booking.checkIn,
          checkOut: booking.checkOut
        }))
      });
    }

    // Calculate total price
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const pricePerNight = parseFloat(spot.price);
    const totalPrice = nights * pricePerNight;

    // Determine booking status based on instant book
    const bookingStatus = spot.isInstantBook ? 'CONFIRMED' : 'PENDING';
    const paymentStatus = 'PENDING'; // Default payment status

    // Create booking with transaction to ensure data consistency
    const booking = await req.prisma.$transaction(async (prisma) => {
      // Double-check for conflicts within transaction
      const finalConflictCheck = await prisma.booking.findMany({
        where: {
          spotId: spotIdInt,
          status: {
            in: ['CONFIRMED', 'PENDING']
          },
          OR: [
            {
              AND: [
                { checkIn: { lt: checkInDate } },
                { checkOut: { gt: checkInDate } }
              ]
            },
            {
              AND: [
                { checkIn: { lt: checkOutDate } },
                { checkOut: { gt: checkOutDate } }
              ]
            },
            {
              AND: [
                { checkIn: { gte: checkInDate } },
                { checkOut: { lte: checkOutDate } }
              ]
            },
            {
              AND: [
                { checkIn: { lte: checkInDate } },
                { checkOut: { gte: checkOutDate } }
              ]
            }
          ]
        }
      });

      if (finalConflictCheck.length > 0) {
        throw new Error('BOOKING_CONFLICT');
      }

      return await prisma.booking.create({
        data: {
          userId: req.user.userId,
          spotId: spotIdInt,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          guests: guestCount,
          totalPrice: totalPrice,
          status: bookingStatus,
          paymentStatus: paymentStatus,
          notes: notes?.trim() || null
        },
        include: {
          spot: {
            select: {
              id: true,
              title: true,
              location: true,
              city: true,
              state: true,
              price: true,
              images: true,
              amenities: true
            }
          },
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true
            }
          }
        }
      });
    });

    // Parse images and amenities safely
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

    res.status(201).json({
      message: 'Booking created successfully',
      booking: {
        ...booking,
        spot: {
          ...booking.spot,
          images: spotImages,
          amenities: spotAmenities
        },
        nights,
        pricePerNight: pricePerNight
      }
    });

  } catch (error) {
    console.error('Error creating booking:', error);
    
    if (error.message === 'BOOKING_CONFLICT') {
      return res.status(409).json({
        message: 'The selected dates are no longer available. Please choose different dates.'
      });
    }
    
    // Handle Prisma-specific errors
    if (error.code === 'P2002') {
      return res.status(409).json({
        message: 'A booking conflict occurred. Please try again.'
      });
    }
    
    if (error.code === 'P2003') {
      return res.status(400).json({
        message: 'Invalid spot or user reference'
      });
    }

    res.status(500).json({
      message: 'Error creating booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* GET /api/bookings - Get user's bookings */
router.get('/', async function(req, res, next) {
  try {
    const { status, paymentStatus } = req.query;

    // Build where clause
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

    const bookings = await req.prisma.booking.findMany({
      where,
      include: {
        spot: {
          select: {
            id: true,
            title: true,
            location: true,
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
    });

    // Parse JSON fields and add computed fields
    const bookingsWithExtras = bookings.map(booking => {
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      
      // Safely parse images and amenities
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
        pricePerNight: parseFloat(booking.totalPrice) / nights,
        canCancel: canCancelBooking(booking),
        canReview: canReviewBooking(booking)
      };
    });

    res.json({
      message: 'Bookings retrieved successfully',
      bookings: bookingsWithExtras
    });

  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      message: 'Error fetching bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
                email: true,
                phone: true
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
      }
    }
    
    if (booking.spot.amenities) {
      try {
        spotAmenities = typeof booking.spot.amenities === 'string' 
          ? JSON.parse(booking.spot.amenities) 
          : booking.spot.amenities;
      } catch (e) {
        console.warn('Failed to parse spot amenities:', e);
      }
    }

    const enrichedBooking = {
      ...booking,
      totalPrice: parseFloat(booking.totalPrice),
      spot: {
        ...booking.spot,
        price: parseFloat(booking.spot.price),
        images: spotImages,
        amenities: spotAmenities
      },
      nights,
      pricePerNight: parseFloat(booking.totalPrice) / nights,
      canCancel: canCancelBooking(booking),
      canReview: canReviewBooking(booking)
    };

    res.json({ 
      message: 'Booking retrieved successfully',
      booking: enrichedBooking 
    });

  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      message: 'Error fetching booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    if (booking.status === 'REFUNDED') {
      return res.status(400).json({
        message: 'Cannot cancel a refunded booking'
      });
    }

    // Check if booking can still be cancelled
    if (!canCancelBooking(booking)) {
      return res.status(400).json({
        message: 'Bookings can only be cancelled at least 24 hours before check-in'
      });
    }

    // Determine if refund is applicable
    const paymentStatus = booking.paymentStatus === 'PAID' ? 'REFUNDED' : booking.paymentStatus;

    const updatedBooking = await req.prisma.booking.update({
      where: { id: bookingId },
      data: { 
        status: 'CANCELLED',
        paymentStatus: paymentStatus,
        notes: reason ? `Cancelled: ${reason}` : booking.notes,
        updatedAt: new Date()
      }
    });

    res.json({
      message: 'Booking cancelled successfully',
      booking: {
        ...updatedBooking,
        totalPrice: parseFloat(updatedBooking.totalPrice)
      }
    });

  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      message: 'Error cancelling booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* PUT /api/bookings/:id/payment - Update payment status */
router.put('/:id/payment', async function(req, res, next) {
  try {
    const bookingId = parseInt(req.params.id);
    const { paymentStatus, paymentMethod, transactionId } = req.body;
    
    if (isNaN(bookingId)) {
      return res.status(400).json({
        message: 'Invalid booking ID'
      });
    }

    // Validate payment status
    const validPaymentStatuses = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];
    if (!paymentStatus || !validPaymentStatuses.includes(paymentStatus.toUpperCase())) {
      return res.status(400).json({
        message: 'Valid payment status is required (PENDING, PAID, FAILED, REFUNDED)'
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

    const updateData = {
      paymentStatus: paymentStatus.toUpperCase(),
      updatedAt: new Date()
    };

    // If payment is successful, confirm the booking
    if (paymentStatus.toUpperCase() === 'PAID' && booking.status === 'PENDING') {
      updateData.status = 'CONFIRMED';
    }

    // Add payment notes if provided
    if (paymentMethod || transactionId) {
      const paymentInfo = [];
      if (paymentMethod) paymentInfo.push(`Payment method: ${paymentMethod}`);
      if (transactionId) paymentInfo.push(`Transaction ID: ${transactionId}`);
      
      updateData.notes = booking.notes 
        ? `${booking.notes}\n${paymentInfo.join(', ')}`
        : paymentInfo.join(', ');
    }

    const updatedBooking = await req.prisma.booking.update({
      where: { id: bookingId },
      data: updateData
    });

    res.json({
      message: 'Payment status updated successfully',
      booking: {
        ...updatedBooking,
        totalPrice: parseFloat(updatedBooking.totalPrice)
      }
    });

  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({
      message: 'Error updating payment status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
    const ratingNum = parseInt(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
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

    if (!canReviewBooking(booking)) {
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
        rating: ratingNum,
        comment: comment?.trim() || null,
        isVerified: true
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            avatar: true
          }
        },
        spot: {
          select: {
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to check if booking can be cancelled
function canCancelBooking(booking, hoursBeforeCheckIn = 24) {
  const checkInDate = new Date(booking.checkIn);
  const now = new Date();
  const hoursUntilCheckIn = (checkInDate - now) / (1000 * 60 * 60);
  
  return hoursUntilCheckIn >= hoursBeforeCheckIn && 
         !['CANCELLED', 'COMPLETED', 'REFUNDED'].includes(booking.status);
}

// Helper function to check if booking can be reviewed
function canReviewBooking(booking) {
  return booking.status === 'COMPLETED' && booking.paymentStatus === 'PAID';
}

module.exports = router;