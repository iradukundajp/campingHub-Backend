var express = require('express');
var router = express.Router();
const { authenticateToken, requireOwner } = require('../middleware/auth');

// Apply authentication to all owner routes
router.use(authenticateToken);
router.use(requireOwner);

/* GET /api/owners/spots - Get all camping spots owned by the current user */
router.get('/spots', async function(req, res, next) {
  try {
    const spots = await req.prisma.campingSpot.findMany({
      where: { ownerId: req.user.userId },
      include: {
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
        bookings: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
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
    const spotsWithStats = spots.map(spot => {
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
      spots: spotsWithStats,
      total: spotsWithStats.length
    });

  } catch (error) {
    console.error('Error fetching owner spots:', error);
    res.status(500).json({
      message: 'Error fetching your camping spots',
      error: error.message
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
      price,
      capacity,
      amenities,
      images,
      latitude,
      longitude
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
      title,
      description,
      location,
      price: parseFloat(price),
      capacity: parseInt(capacity),
      ownerId: req.user.userId
    };

    // Add optional fields if provided
    if (amenities) {
      spotData.amenities = typeof amenities === 'string' ? amenities : JSON.stringify(amenities);
    }
    if (images) {
      spotData.images = typeof images === 'string' ? images : JSON.stringify(images);
    }
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
      spot: newSpot
    });

  } catch (error) {
    console.error('Error creating camping spot:', error);
    res.status(500).json({
      message: 'Error creating camping spot',
      error: error.message
    });
  }
});

/* PUT /api/owners/spots/:id - Update a camping spot */
router.put('/spots/:id', async function(req, res, next) {
  try {
    const spotId = parseInt(req.params.id);
    
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
      price,
      capacity,
      amenities,
      images,
      latitude,
      longitude,
      isActive
    } = req.body;

    const updateData = {};

    // Only update provided fields
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (location) updateData.location = location;
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
    if (amenities !== undefined) {
      updateData.amenities = typeof amenities === 'string' ? amenities : JSON.stringify(amenities);
    }
    if (images !== undefined) {
      updateData.images = typeof images === 'string' ? images : JSON.stringify(images);
    }
    if (latitude !== undefined) updateData.latitude = parseFloat(latitude);
    if (longitude !== undefined) updateData.longitude = parseFloat(longitude);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: 'No valid fields provided for update'
      });
    }

    const updatedSpot = await req.prisma.campingSpot.update({
      where: { id: spotId },
      data: updateData,
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

/* DELETE /api/owners/spots/:id - Delete a camping spot */
router.delete('/spots/:id', async function(req, res, next) {
  try {
    const spotId = parseInt(req.params.id);
    
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
        status: 'CONFIRMED',
        checkOut: {
          gte: new Date()
        }
      }
    });

    if (activeBookings.length > 0) {
      return res.status(400).json({
        message: 'Cannot delete camping spot with active bookings'
      });
    }

    await req.prisma.campingSpot.delete({
      where: { id: spotId }
    });

    res.json({
      message: 'Camping spot deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting camping spot:', error);
    res.status(500).json({
      message: 'Error deleting camping spot',
      error: error.message
    });
  }
});

/* GET /api/owners/bookings - Get all bookings for owner's spots */
router.get('/bookings', async function(req, res, next) {
  try {
    const bookings = await req.prisma.booking.findMany({
      where: {
        spot: {
          ownerId: req.user.userId
        }
      },
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
            location: true
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
    console.error('Error fetching owner bookings:', error);
    res.status(500).json({
      message: 'Error fetching bookings',
      error: error.message
    });
  }
});

module.exports = router;