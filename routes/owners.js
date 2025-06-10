var express = require('express');
var router = express.Router();
const { authenticateToken, requireOwner } = require('../middleware/auth');

// Apply authentication to all owner routes
router.use(authenticateToken);
router.use(requireOwner);

/* GET /api/owners/spots - Get all camping spots owned by the current user */
router.get('/spots', async function(req, res, next) {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const where = { ownerId: req.user.userId };
    
    if (status !== undefined) {
      where.isActive = status === 'active';
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [spots, total] = await Promise.all([
      req.prisma.campingSpot.findMany({
        where,
        skip,
        take: limitNum,
        include: {
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
        orderBy: {
          createdAt: 'desc'
        }
      }),
      req.prisma.campingSpot.count({ where })
    ]);

    // Calculate average rating for each spot
    const spotsWithStats = spots.map(spot => {
      const avgRating = spot.reviews.length > 0 
        ? spot.reviews.reduce((sum, review) => sum + review.rating, 0) / spot.reviews.length
        : 0;
      
      return {
        ...spot,
        price: parseFloat(spot.price),
        images: spot.images ? JSON.parse(spot.images) : [],
        amenities: spot.amenities ? JSON.parse(spot.amenities) : [],
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews: spot.reviews.length,
        totalBookings: spot._count.bookings
      };
    });

    res.json({
      message: 'Spots retrieved successfully',
      spots: spotsWithStats,
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
    console.error('Error fetching owner spots:', error);
    res.status(500).json({
      message: 'Error fetching your camping spots',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* POST /api/owners/spots - Create a new camping spot */
router.post('/spots', async function(req, res, next) {
  try {
    const {
      title,
      description,
      location,
      address,
      city,
      state,
      country = 'USA',
      zipCode,
      price,
      capacity,
      amenities,
      images,
      rules,
      latitude,
      longitude,
      isInstantBook = false
    } = req.body;

    // Validation
    if (!title || !description || !location || !price || !capacity) {
      return res.status(400).json({
        message: 'Required fields: title, description, location, price, capacity'
      });
    }

    if (price <= 0) {
      return res.status(400).json({
        message: 'Price must be greater than 0'
      });
    }

    if (capacity <= 0) {
      return res.status(400).json({
        message: 'Capacity must be greater than 0'
      });
    }

    const spotData = {
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      price: parseFloat(price),
      capacity: parseInt(capacity),
      isInstantBook: Boolean(isInstantBook),
      isActive: true,
      ownerId: req.user.userId
    };

    // Add optional fields if provided
    if (address) spotData.address = address.trim();
    if (city) spotData.city = city.trim();
    if (state) spotData.state = state.trim();
    if (country) spotData.country = country.trim();
    if (zipCode) spotData.zipCode = zipCode.trim();
    if (rules) spotData.rules = rules.trim();
    if (amenities) spotData.amenities = amenities;
    if (images) spotData.images = images;
    if (latitude) spotData.latitude = parseFloat(latitude);
    if (longitude) spotData.longitude = parseFloat(longitude);

    const newSpot = await req.prisma.campingSpot.create({
      data: spotData,
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Camping spot created successfully',
      spot: {
        ...newSpot,
        price: parseFloat(newSpot.price),
        images: newSpot.images ? JSON.parse(newSpot.images) : [],
        amenities: newSpot.amenities ? JSON.parse(newSpot.amenities) : []
      }
    });

  } catch (error) {
    console.error('Error creating camping spot:', error);
    res.status(500).json({
      message: 'Error creating camping spot',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* PUT /api/owners/spots/:id - Update a camping spot */
router.put('/spots/:id', async function(req, res, next) {
  try {
    const spotId = parseInt(req.params.id);
    
    if (isNaN(spotId)) {
      return res.status(400).json({
        message: 'Invalid spot ID'
      });
    }

    // Check if spot exists and belongs to the owner
    const existingSpot = await req.prisma.campingSpot.findFirst({
      where: {
        id: spotId,
        ownerId: req.user.userId
      }
    });

    if (!existingSpot) {
      return res.status(404).json({
        message: 'Camping spot not found or you do not have permission to edit it'
      });
    }

    const {
      title,
      description,
      location,
      address,
      city,
      state,
      country,
      zipCode,
      price,
      capacity,
      amenities,
      images,
      rules,
      latitude,
      longitude,
      isActive,
      isInstantBook
    } = req.body;

    const updateData = {};

    // Only update provided fields
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (location !== undefined) updateData.location = location.trim();
    if (address !== undefined) updateData.address = address ? address.trim() : null;
    if (city !== undefined) updateData.city = city ? city.trim() : null;
    if (state !== undefined) updateData.state = state ? state.trim() : null;
    if (country !== undefined) updateData.country = country ? country.trim() : null;
    if (zipCode !== undefined) updateData.zipCode = zipCode ? zipCode.trim() : null;
    if (rules !== undefined) updateData.rules = rules ? rules.trim() : null;
    
    if (price !== undefined) {
      if (price <= 0) {
        return res.status(400).json({
          message: 'Price must be greater than 0'
        });
      }
      updateData.price = parseFloat(price);
    }
    
    if (capacity !== undefined) {
      if (capacity <= 0) {
        return res.status(400).json({
          message: 'Capacity must be greater than 0'
        });
      }
      updateData.capacity = parseInt(capacity);
    }
    
    if (amenities !== undefined) updateData.amenities = amenities;
    if (images !== undefined) updateData.images = images;
    if (latitude !== undefined) updateData.latitude = latitude ? parseFloat(latitude) : null;
    if (longitude !== undefined) updateData.longitude = longitude ? parseFloat(longitude) : null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (isInstantBook !== undefined) updateData.isInstantBook = Boolean(isInstantBook);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: 'No valid fields provided for update'
      });
    }

    updateData.updatedAt = new Date();

    const updatedSpot = await req.prisma.campingSpot.update({
      where: { id: spotId },
      data: updateData
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
    console.error('Error updating camping spot:', error);
    res.status(500).json({
      message: 'Error updating camping spot',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* DELETE /api/owners/spots/:id - Delete a camping spot */
router.delete('/spots/:id', async function(req, res, next) {
  try {
    const spotId = parseInt(req.params.id);
    
    if (isNaN(spotId)) {
      return res.status(400).json({
        message: 'Invalid spot ID'
      });
    }

    // Check if spot exists and belongs to the owner
    const existingSpot = await req.prisma.campingSpot.findFirst({
      where: {
        id: spotId,
        ownerId: req.user.userId
      }
    });

    if (!existingSpot) {
      return res.status(404).json({
        message: 'Camping spot not found or you do not have permission to delete it'
      });
    }

    // Check if there are active bookings
    const activeBookings = await req.prisma.booking.findMany({
      where: {
        spotId: spotId,
        status: {
          in: ['CONFIRMED', 'PENDING']
        },
        checkOut: {
          gte: new Date()
        }
      }
    });

    if (activeBookings.length > 0) {
      return res.status(400).json({
        message: 'Cannot delete camping spot with active bookings. Please wait for all bookings to complete or be cancelled.'
      });
    }

    // Soft delete by setting isActive to false
    await req.prisma.campingSpot.update({
      where: { id: spotId },
      data: { 
        isActive: false,
        updatedAt: new Date()
      }
    });

    res.json({
      message: 'Camping spot deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting camping spot:', error);
    res.status(500).json({
      message: 'Error deleting camping spot',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* GET /api/owners/bookings - Get all bookings for owner's spots */
router.get('/bookings', async function(req, res, next) {
  try {
    const { status, paymentStatus, page = 1, limit = 20 } = req.query;

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const where = {
      spot: {
        ownerId: req.user.userId
      }
    };

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
              price: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
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
    console.error('Error fetching owner bookings:', error);
    res.status(500).json({
      message: 'Error fetching bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* PUT /api/owners/bookings/:id - Update booking status (approve/reject) */
router.put('/bookings/:id', async function(req, res, next) {
  try {
    const bookingId = parseInt(req.params.id);
    const { status, notes } = req.body;
    
    if (isNaN(bookingId)) {
      return res.status(400).json({
        message: 'Invalid booking ID'
      });
    }

    // Validate status
    const validStatuses = ['CONFIRMED', 'CANCELLED'];
    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({
        message: 'Status must be either CONFIRMED or CANCELLED'
      });
    }
    
    // Find booking and verify ownership
    const booking = await req.prisma.booking.findFirst({
      where: {
        id: bookingId,
        spot: {
          ownerId: req.user.userId
        }
      },
      include: {
        spot: {
          select: {
            title: true,
            ownerId: true
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

    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found or you do not have permission to modify it'
      });
    }

    if (booking.status !== 'PENDING') {
      return res.status(400).json({
        message: 'Only pending bookings can be approved or rejected'
      });
    }

    const updateData = {
      status: status.toUpperCase(),
      updatedAt: new Date()
    };

    if (notes) {
      updateData.notes = notes.trim();
    }

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

    const actionWord = status.toUpperCase() === 'CONFIRMED' ? 'approved' : 'rejected';
    
    res.json({
      message: `Booking ${actionWord} successfully`,
      booking: {
        ...updatedBooking,
        totalPrice: parseFloat(updatedBooking.totalPrice)
      }
    });

  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({
      message: 'Error updating booking status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* GET /api/owners/dashboard - Owner dashboard stats */
router.get('/dashboard', async function(req, res, next) {
  try {
    const ownerId = req.user.userId;

    // Get owner statistics
    const [
      totalSpots,
      activeSpots,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      totalRevenue,
      recentBookings
    ] = await Promise.all([
      req.prisma.campingSpot.count({
        where: { ownerId }
      }),
      req.prisma.campingSpot.count({
        where: { ownerId, isActive: true }
      }),
      req.prisma.booking.count({
        where: {
          spot: { ownerId }
        }
      }),
      req.prisma.booking.count({
        where: {
          spot: { ownerId },
          status: 'PENDING'
        }
      }),
      req.prisma.booking.count({
        where: {
          spot: { ownerId },
          status: 'CONFIRMED'
        }
      }),
      req.prisma.booking.aggregate({
        _sum: { totalPrice: true },
        where: {
          spot: { ownerId },
          status: 'CONFIRMED',
          paymentStatus: 'PAID'
        }
      }),
      req.prisma.booking.findMany({
        take: 5,
        where: {
          spot: { ownerId }
        },
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
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    ]);

    const formattedRecentBookings = recentBookings.map(booking => ({
      ...booking,
      totalPrice: parseFloat(booking.totalPrice),
      nights: Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24))
    }));

    res.json({
      message: 'Dashboard data retrieved successfully',
      dashboard: {
        stats: {
          totalSpots,
          activeSpots,
          inactiveSpots: totalSpots - activeSpots,
          totalBookings,
          pendingBookings,
          confirmedBookings,
          totalRevenue: parseFloat(totalRevenue._sum.totalPrice || 0)
        },
        recentBookings: formattedRecentBookings
      }
    });

  } catch (error) {
    console.error('Error fetching owner dashboard:', error);
    res.status(500).json({
      message: 'Error fetching dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;