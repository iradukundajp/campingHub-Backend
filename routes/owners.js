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
    });

    // Calculate average rating for each spot
    const spotsWithStats = spots.map(spot => {
      const avgRating = spot.reviews.length > 0 
        ? spot.reviews.reduce((sum, review) => sum + review.rating, 0) / spot.reviews.length
        : 0;
      
      return {
        ...spot,
        images: spot.images ? JSON.parse(spot.images) : [],
        amenities: spot.amenities ? JSON.parse(spot.amenities) : [],
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews: spot.reviews.length,
        totalBookings: spot._count.bookings
      };
    });

    res.json({
      message: 'Spots retrieved successfully',
      spots: spotsWithStats
    });

  } catch (error) {
    console.error('Error fetching owner spots:', error);
    res.status(500).json({
      message: 'Error fetching your camping spots'
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
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      price: parseFloat(price),
      capacity: parseInt(capacity),
      ownerId: req.user.userId
    };

    // Add optional fields if provided
    if (amenities) {
      spotData.amenities = Array.isArray(amenities) ? JSON.stringify(amenities) : amenities;
    }
    if (images) {
      spotData.images = Array.isArray(images) ? JSON.stringify(images) : images;
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
      spot: {
        ...newSpot,
        images: newSpot.images ? JSON.parse(newSpot.images) : [],
        amenities: newSpot.amenities ? JSON.parse(newSpot.amenities) : []
      }
    });

  } catch (error) {
    console.error('Error creating camping spot:', error);
    res.status(500).json({
      message: 'Error creating camping spot'
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
    if (title) updateData.title = title.trim();
    if (description) updateData.description = description.trim();
    if (location) updateData.location = location.trim();
    
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
      updateData.amenities = Array.isArray(amenities) ? JSON.stringify(amenities) : amenities;
    }
    if (images !== undefined) {
      updateData.images = Array.isArray(images) ? JSON.stringify(images) : images;
    }
    if (latitude !== undefined) updateData.latitude = parseFloat(latitude);
    if (longitude !== undefined) updateData.longitude = parseFloat(longitude);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

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
        images: updatedSpot.images ? JSON.parse(updatedSpot.images) : [],
        amenities: updatedSpot.amenities ? JSON.parse(updatedSpot.amenities) : []
      }
    });

  } catch (error) {
    console.error('Error updating camping spot:', error);
    res.status(500).json({
      message: 'Error updating camping spot'
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
      message: 'Error deleting camping spot'
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
      message: 'Bookings retrieved successfully',
      bookings
    });

  } catch (error) {
    console.error('Error fetching owner bookings:', error);
    res.status(500).json({
      message: 'Error fetching bookings'
    });
  }
});

module.exports = router;