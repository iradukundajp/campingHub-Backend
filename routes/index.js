const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Helper function to parse JSON fields safely
function parseJsonField(field) {
  if (!field) return [];
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch (e) {
      return [];
    }
  }
  return Array.isArray(field) ? field : [];
}

// Helper function to calculate average rating
function calculateAverageRating(reviews) {
  if (!reviews || reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

/* ===== TEST ROUTES ===== */

/* Test route */
router.get('/', function(req, res, next) {
  res.json({ 
    message: 'CampingHub API is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/* Test database connection */
router.get('/test-db', async function(req, res, next) {
  try {
    const userCount = await req.prisma.user.count();
    const spotCount = await req.prisma.campingSpot.count();
    
    res.json({
      message: 'Database connection successful',
      counts: {
        users: userCount,
        campingSpots: spotCount
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      message: 'Database connection failed',
      error: error.message
    });
  }
});

/* ===== AUTHENTICATION ROUTES ===== */

/* POST login - FIXED: Removed lastLogin update */
router.post('/auth/login', async function(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await req.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Note: Removed lastLogin update to keep authentication simple

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/* POST register */
router.post('/auth/register', async function(req, res, next) {
  try {
    const { firstName, lastName, email, password, role = 'USER' } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        message: 'All fields are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await req.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await req.prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: role.toUpperCase(),
        isActive: true
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/* GET current user profile */
router.get('/auth/me', authenticateToken, async function(req, res, next) {
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    res.json({
      message: 'User profile retrieved successfully',
      user
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      message: 'Failed to retrieve user profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/* PUT update user profile */
router.put('/auth/profile', authenticateToken, async function(req, res, next) {
  try {
    const { firstName, lastName, email } = req.body;
    const updateData = {};

    // Validate and prepare update data
    if (firstName !== undefined) {
      if (!firstName || firstName.trim().length < 2) {
        return res.status(400).json({
          message: 'First name must be at least 2 characters long'
        });
      }
      updateData.firstName = firstName.trim();
    }

    if (lastName !== undefined) {
      if (!lastName || lastName.trim().length < 2) {
        return res.status(400).json({
          message: 'Last name must be at least 2 characters long'
        });
      }
      updateData.lastName = lastName.trim();
    }
    
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          message: 'Please provide a valid email address'
        });
      }
      
      // Check if email is already taken
      const existingUser = await req.prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          id: { not: req.user.userId }
        }
      });

      if (existingUser) {
        return res.status(409).json({
          message: 'Email is already taken by another user'
        });
      }
      
      updateData.email = email.toLowerCase();
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: 'No valid fields provided for update'
      });
    }

    updateData.updatedAt = new Date();

    const updatedUser = await req.prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        updatedAt: true
      }
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      message: 'Error updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/* ===== CAMPING SPOTS ROUTES ===== */

/* GET all camping spots with search and filter */
router.get('/spots', async function(req, res, next) {
  try {
    const { 
      search, 
      location, 
      minPrice, 
      maxPrice, 
      capacity,
      checkIn,
      checkOut,
      category,
      page = 1,
      limit = 12,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Pagination with proper validation
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12));
    const skip = (pageNum - 1) * limitNum;
    
    // Build filter object
    const where = {
      isActive: true
    };

    // Add search filter
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { location: { contains: searchTerm, mode: 'insensitive' } }
      ];
    }

    // Add location filter
    if (location && location.trim()) {
      where.location = { contains: location.trim(), mode: 'insensitive' };
    }

    // Add price filters with validation
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) {
        const min = parseFloat(minPrice);
        if (!isNaN(min) && min >= 0) {
          where.price.gte = min;
        }
      }
      if (maxPrice) {
        const max = parseFloat(maxPrice);
        if (!isNaN(max) && max >= 0) {
          where.price.lte = max;
        }
      }
    }

    // Add capacity filter
    if (capacity) {
      const cap = parseInt(capacity);
      if (!isNaN(cap) && cap > 0) {
        where.capacity = { gte: cap };
      }
    }

    // Add category filter
    if (category && category.trim()) {
      where.amenities = { contains: category.trim(), mode: 'insensitive' };
    }

    // Build orderBy clause with validation
    let orderBy = { createdAt: 'desc' };
    const validSortFields = ['createdAt', 'price', 'title', 'capacity', 'averageRating'];
    const validSortOrders = ['asc', 'desc'];
    
    if (validSortFields.includes(sortBy) && validSortOrders.includes(sortOrder.toLowerCase())) {
      if (sortBy === 'averageRating') {
        // Special handling for averageRating - we'll sort after calculating
        orderBy = null;
      } else {
        orderBy = { [sortBy]: sortOrder.toLowerCase() };
      }
    }

    let spots, total;
    try {
      const queryOptions = {
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
        }
      };

      if (orderBy) {
        queryOptions.orderBy = orderBy;
      }

      [spots, total] = await Promise.all([
        req.prisma.campingSpot.findMany(queryOptions),
        req.prisma.campingSpot.count({ where })
      ]);
    } catch (dbError) {
      console.error('Database query error:', dbError);
      return res.status(500).json({
        message: 'Database query failed',
        error: process.env.NODE_ENV === 'development' ? dbError.message : 'Internal server error'
      });
    }

    // Process spots with calculated fields and safe JSON parsing
    const spotsWithRating = spots.map(spot => {
      const parsedAmenities = parseJsonField(spot.amenities);
      const parsedImages = parseJsonField(spot.images);
      const avgRating = calculateAverageRating(spot.reviews);
      
      return {
        id: spot.id,
        title: spot.title,
        description: spot.description,
        location: spot.location,
        price: parseFloat(spot.price),
        capacity: spot.capacity,
        latitude: spot.latitude,
        longitude: spot.longitude,
        isActive: spot.isActive,
        isInstantBook: spot.isInstantBook,
        amenities: parsedAmenities,
        images: parsedImages,
        averageRating: avgRating,
        totalReviews: spot.reviews.length,
        totalBookings: spot._count.bookings,
        owner: spot.owner,
        createdAt: spot.createdAt,
        updatedAt: spot.updatedAt
      };
    });

    // Sort by averageRating if specified
    if (sortBy === 'averageRating') {
      spotsWithRating.sort((a, b) => {
        return sortOrder.toLowerCase() === 'desc' 
          ? b.averageRating - a.averageRating 
          : a.averageRating - b.averageRating;
      });
    }
    
    const totalPages = Math.ceil(total / limitNum);
    
    res.json({
      message: 'Camping spots retrieved successfully',
      spots: spotsWithRating,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      },
      filters: {
        search,
        location,
        minPrice,
        maxPrice,
        capacity,
        checkIn,
        checkOut,
        category,
        sortBy,
        sortOrder
      }
    });
  } catch (error) {
    console.error('Error fetching spots:', error);
    res.status(500).json({
      message: 'Error fetching camping spots',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/* GET single camping spot - FIXED: Removed booking status filter */
router.get('/spots/:id', async function(req, res, next) {
  try {
    const { id } = req.params;

    const spot = await req.prisma.campingSpot.findUnique({
      where: { 
        id: parseInt(id),
        isActive: true 
      },
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
          select: {
            checkIn: true,
            checkOut: true,
            status: true
          }
          // Removed status filter to avoid enum mismatch
        },
        _count: {
          select: {
            bookings: true,
            reviews: true
          }
        }
      }
    });

    if (!spot) {
      return res.status(404).json({
        message: 'Camping spot not found'
      });
    }

    // Parse JSON fields safely
    const parsedAmenities = parseJsonField(spot.amenities);
    const parsedImages = parseJsonField(spot.images);
    const avgRating = calculateAverageRating(spot.reviews);

    // Filter confirmed bookings manually for unavailable dates
    const confirmedBookings = spot.bookings.filter(booking => 
      booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN'
    );

    const spotWithDetails = {
      id: spot.id,
      title: spot.title,
      description: spot.description,
      location: spot.location,
      price: parseFloat(spot.price),
      capacity: spot.capacity,
      latitude: spot.latitude,
      longitude: spot.longitude,
      isActive: spot.isActive,
      isInstantBook: spot.isInstantBook,
      amenities: parsedAmenities,
      images: parsedImages,
      averageRating: avgRating,
      totalReviews: spot.reviews.length,
      totalBookings: spot._count.bookings,
      owner: spot.owner,
      reviews: spot.reviews,
      unavailableDates: confirmedBookings.map(booking => ({
        checkIn: booking.checkIn,
        checkOut: booking.checkOut
      })),
      createdAt: spot.createdAt,
      updatedAt: spot.updatedAt
    };

    res.json({
      message: 'Camping spot retrieved successfully',
      spot: spotWithDetails
    });
  } catch (error) {
    console.error('Error fetching spot:', error);
    res.status(500).json({
      message: 'Error fetching camping spot',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/* POST create camping spot */
router.post('/spots', authenticateToken, authorizeRole(['OWNER', 'ADMIN']), async function(req, res, next) {
  try {
    const {
      title,
      description,
      location,
      price,
      capacity,
      latitude,
      longitude,
      amenities = [],
      images = [],
      isInstantBook = false
    } = req.body;

    // Validation
    if (!title || !description || !location || !price || !capacity) {
      return res.status(400).json({
        message: 'Title, description, location, price, and capacity are required'
      });
    }

    if (parseFloat(price) <= 0) {
      return res.status(400).json({
        message: 'Price must be greater than 0'
      });
    }

    if (parseInt(capacity) <= 0) {
      return res.status(400).json({
        message: 'Capacity must be greater than 0'
      });
    }

    const spot = await req.prisma.campingSpot.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        price: parseFloat(price),
        capacity: parseInt(capacity),
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        amenities: JSON.stringify(amenities),
        images: JSON.stringify(images),
        isInstantBook: Boolean(isInstantBook),
        isActive: true,
        ownerId: req.user.userId
      },
      include: {
        owner: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Parse JSON fields for response
    const parsedAmenities = parseJsonField(spot.amenities);
    const parsedImages = parseJsonField(spot.images);

    const spotWithDetails = {
      ...spot,
      amenities: parsedAmenities,
      images: parsedImages,
      price: parseFloat(spot.price)
    };

    res.status(201).json({
      message: 'Camping spot created successfully',
      spot: spotWithDetails
    });
  } catch (error) {
    console.error('Error creating spot:', error);
    res.status(500).json({
      message: 'Error creating camping spot',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/* PUT update camping spot */
router.put('/spots/:id', authenticateToken, async function(req, res, next) {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      location,
      price,
      capacity,
      latitude,
      longitude,
      amenities,
      images,
      isInstantBook,
      isActive
    } = req.body;

    // Find the spot first
    const existingSpot = await req.prisma.campingSpot.findUnique({
      where: { id: parseInt(id) },
      select: { ownerId: true }
    });

    if (!existingSpot) {
      return res.status(404).json({
        message: 'Camping spot not found'
      });
    }

    // Check ownership or admin rights
    if (existingSpot.ownerId !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        message: 'You can only update your own camping spots'
      });
    }

    // Prepare update data
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (location !== undefined) updateData.location = location.trim();
    if (price !== undefined) {
      const priceValue = parseFloat(price);
      if (priceValue <= 0) {
        return res.status(400).json({
          message: 'Price must be greater than 0'
        });
      }
      updateData.price = priceValue;
    }
    if (capacity !== undefined) {
      const capacityValue = parseInt(capacity);
      if (capacityValue <= 0) {
        return res.status(400).json({
          message: 'Capacity must be greater than 0'
        });
      }
      updateData.capacity = capacityValue;
    }
    if (latitude !== undefined) updateData.latitude = latitude ? parseFloat(latitude) : null;
    if (longitude !== undefined) updateData.longitude = longitude ? parseFloat(longitude) : null;
    if (amenities !== undefined) updateData.amenities = JSON.stringify(amenities);
    if (images !== undefined) updateData.images = JSON.stringify(images);
    if (isInstantBook !== undefined) updateData.isInstantBook = Boolean(isInstantBook);
    if (isActive !== undefined && req.user.role === 'ADMIN') {
      updateData.isActive = Boolean(isActive);
    }

    updateData.updatedAt = new Date();

    const updatedSpot = await req.prisma.campingSpot.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        owner: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Parse JSON fields for response
    const parsedAmenities = parseJsonField(updatedSpot.amenities);
    const parsedImages = parseJsonField(updatedSpot.images);

    const spotWithDetails = {
      ...updatedSpot,
      amenities: parsedAmenities,
      images: parsedImages,
      price: parseFloat(updatedSpot.price)
    };

    res.json({
      message: 'Camping spot updated successfully',
      spot: spotWithDetails
    });
  } catch (error) {
    console.error('Error updating spot:', error);
    res.status(500).json({
      message: 'Error updating camping spot',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/* DELETE camping spot */
router.delete('/spots/:id', authenticateToken, async function(req, res, next) {
  try {
    const { id } = req.params;

    // Find the spot first
    const existingSpot = await req.prisma.campingSpot.findUnique({
      where: { id: parseInt(id) },
      select: { ownerId: true, title: true }
    });

    if (!existingSpot) {
      return res.status(404).json({
        message: 'Camping spot not found'
      });
    }

    // Check ownership or admin rights
    if (existingSpot.ownerId !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        message: 'You can only delete your own camping spots'
      });
    }

    // Soft delete by setting isActive to false
    await req.prisma.campingSpot.update({
      where: { id: parseInt(id) },
      data: { 
        isActive: false,
        updatedAt: new Date()
      }
    });

    res.json({
      message: `Camping spot "${existingSpot.title}" deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting spot:', error);
    res.status(500).json({
      message: 'Error deleting camping spot',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;