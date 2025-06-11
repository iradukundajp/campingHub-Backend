const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// 🆕 FIXED: Safe JSON parsing helper function
function parseJsonField(field) {
  if (!field) return [];
  
  // If it's already an array/object, return it
  if (typeof field !== 'string') {
    return Array.isArray(field) ? field : [];
  }
  
  // If it's a string, try to parse it
  try {
    const parsed = JSON.parse(field);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('JSON parsing failed for field:', field, 'Error:', error.message);
    
    // If it looks like a single URL, wrap it in an array
    if (field.startsWith('http') || field.startsWith('/uploads/')) {
      return [field];
    }
    
    return [];
  }
}

// Helper function to convert relative image URLs to full URLs
function fixImageUrls(req, images) {
  if (!images || !Array.isArray(images)) return images;
  
  return images.map(url => {
    // If it's already a full URL (external or already processed), return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If it's a relative path to uploads, convert to full URL
    if (url.startsWith('/uploads/')) {
      const protocol = req.protocol;
      const host = req.get('host');
      return `${protocol}://${host}${url}`;
    }
    
    // If it's just the filename, add the full path
    if (url.includes('camping-') && !url.includes('/')) {
      const protocol = req.protocol;
      const host = req.get('host');
      return `${protocol}://${host}/uploads/${url}`;
    }
    
    return url;
  });
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
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

/* Test database connection */
router.get('/test-db', async function(req, res, next) {
  try {
    const userCount = await req.prisma.user.count();
    const spotCount = await req.prisma.campingSpot.count();
    const bookingCount = await req.prisma.booking.count();
    
    res.json({
      message: 'Database connection successful',
      counts: {
        users: userCount,
        campingSpots: spotCount,
        bookings: bookingCount
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

/* POST login */
router.post('/auth/login', async function(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required'
      });
    }

    // Find user by email (case-insensitive search for MySQL)
    const user = await req.prisma.user.findFirst({
      where: { 
        email: {
          equals: email.toLowerCase()
        }
      }
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
    const { 
      firstName, 
      lastName, 
      email, 
      password, 
      phone,
      role = 'USER' 
    } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        message: 'First name, last name, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters long'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Please provide a valid email address'
      });
    }

    // Check if user already exists (case-insensitive)
    const existingUser = await req.prisma.user.findFirst({
      where: { 
        email: {
          equals: email.toLowerCase()
        }
      }
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user data
    const userData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: role.toUpperCase(),
      isActive: true
    };

    // Add phone if provided
    if (phone && phone.trim()) {
      userData.phone = phone.trim();
    }

    // Create user
    const user = await req.prisma.user.create({
      data: userData
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
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        _count: {
          select: {
            ownedSpots: true,
            bookings: true,
            reviews: true
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
    const { firstName, lastName, email, phone, avatar } = req.body;
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
      
      // Check if email is already taken (case-insensitive)
      const existingUser = await req.prisma.user.findFirst({
        where: {
          email: {
            equals: email.toLowerCase()
          },
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

    if (phone !== undefined) {
      updateData.phone = phone ? phone.trim() : null;
    }

    if (avatar !== undefined) {
      updateData.avatar = avatar ? avatar.trim() : null;
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
        phone: true,
        avatar: true,
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
      city,
      state,
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
    
    console.log('🔍 Search query parameters:', req.query);
    
    // Pagination with proper validation
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12));
    const skip = (pageNum - 1) * limitNum;
    
    // Build filter object
    const where = {
      isActive: true
    };

    // FIXED: MySQL-compatible search without mode parameter
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { title: { contains: searchTerm } },
        { description: { contains: searchTerm } },
        { location: { contains: searchTerm } },
        { city: { contains: searchTerm } },
        { state: { contains: searchTerm } }
      ];
      console.log('🔍 Applied search filter for:', searchTerm);
    }

    // Add location filter
    if (location && location.trim()) {
      where.location = { contains: location.trim() };
      console.log('📍 Applied location filter:', location.trim());
    }

    // Add city filter
    if (city && city.trim()) {
      where.city = { contains: city.trim() };
      console.log('🏙️ Applied city filter:', city.trim());
    }

    // Add state filter
    if (state && state.trim()) {
      where.state = { contains: state.trim() };
      console.log('🗺️ Applied state filter:', state.trim());
    }

    // Add price filters with validation
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) {
        const min = parseFloat(minPrice);
        if (!isNaN(min) && min >= 0) {
          where.price.gte = min;
          console.log('💰 Applied min price filter:', min);
        }
      }
      if (maxPrice) {
        const max = parseFloat(maxPrice);
        if (!isNaN(max) && max >= 0) {
          where.price.lte = max;
          console.log('💰 Applied max price filter:', max);
        }
      }
    }

    // Add capacity filter
    if (capacity) {
      const cap = parseInt(capacity);
      if (!isNaN(cap) && cap > 0) {
        where.capacity = { gte: cap };
        console.log('👥 Applied capacity filter:', cap);
      }
    }

    // FIXED: Add date availability filter
    if (checkIn && checkOut) {
      try {
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        
        if (!isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())) {
          // Exclude spots with conflicting bookings
          where.bookings = {
            none: {
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
                }
              ]
            }
          };
          console.log('📅 Applied date availability filter:', checkIn, 'to', checkOut);
        }
      } catch (dateError) {
        console.warn('⚠️ Invalid date format:', dateError.message);
      }
    }

    // Add category filter (search in amenities JSON)
    if (category && category.trim()) {
      where.amenities = { 
        string_contains: category.trim()
      };
      console.log('🏷️ Applied category filter:', category.trim());
    }

    // Build orderBy clause with validation
    let orderBy = { createdAt: 'desc' };
    const validSortFields = ['createdAt', 'price', 'title', 'capacity'];
    const validSortOrders = ['asc', 'desc'];
    
    if (validSortFields.includes(sortBy) && validSortOrders.includes(sortOrder.toLowerCase())) {
      orderBy = { [sortBy]: sortOrder.toLowerCase() };
      console.log('📊 Applied sorting:', sortBy, sortOrder);
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
        },
        orderBy
      };

      console.log('🗃️ Executing database query with filters:', JSON.stringify(where, null, 2));

      [spots, total] = await Promise.all([
        req.prisma.campingSpot.findMany(queryOptions),
        req.prisma.campingSpot.count({ where })
      ]);

      console.log('✅ Query successful - found', spots.length, 'spots out of', total, 'total');

    } catch (dbError) {
      console.error('❌ Database query error:', dbError);
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
        address: spot.address,
        city: spot.city,
        state: spot.state,
        country: spot.country,
        zipCode: spot.zipCode,
        price: parseFloat(spot.price),
        capacity: spot.capacity,
        latitude: spot.latitude,
        longitude: spot.longitude,
        isActive: spot.isActive,
        isInstantBook: spot.isInstantBook,
        amenities: parsedAmenities,
        images: parsedImages,
        rules: spot.rules,
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
        city,
        state,
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
    console.error('❌ Error fetching spots:', error);
    res.status(500).json({
      message: 'Error fetching camping spots',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/* GET single camping spot */
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
            email: true,
            phone: true
          }
        },
        reviews: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true
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
          },
          where: {
            status: {
              in: ['CONFIRMED', 'PENDING']
            }
          }
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

    const spotWithDetails = {
      id: spot.id,
      title: spot.title,
      description: spot.description,
      location: spot.location,
      address: spot.address,
      city: spot.city,
      state: spot.state,
      country: spot.country,
      zipCode: spot.zipCode,
      price: parseFloat(spot.price),
      capacity: spot.capacity,
      latitude: spot.latitude,
      longitude: spot.longitude,
      isActive: spot.isActive,
      isInstantBook: spot.isInstantBook,
      amenities: parsedAmenities,
      images: parsedImages,
      rules: spot.rules,
      averageRating: avgRating,
      totalReviews: spot.reviews.length,
      totalBookings: spot._count.bookings,
      owner: spot.owner,
      reviews: spot.reviews,
      unavailableDates: spot.bookings.map(booking => ({
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
      address,
      city,
      state,
      country = 'USA',
      zipCode,
      price,
      capacity,
      latitude,
      longitude,
      amenities = [],
      images = [],
      rules,
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

    // Fix image URLs before saving to database
    const fixedImages = fixImageUrls(req, images);

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

    // Add optional fields
    if (address) spotData.address = address.trim();
    if (city) spotData.city = city.trim();
    if (state) spotData.state = state.trim();
    if (country) spotData.country = country.trim();
    if (zipCode) spotData.zipCode = zipCode.trim();
    if (rules) spotData.rules = rules.trim();
    if (latitude) spotData.latitude = parseFloat(latitude);
    if (longitude) spotData.longitude = parseFloat(longitude);
    if (amenities) spotData.amenities = amenities;
    if (fixedImages) spotData.images = fixedImages; // Use fixed URLs

    const spot = await req.prisma.campingSpot.create({
      data: spotData,
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

    console.log(`🏕️ New camping spot created by user ${req.user.userId}: ${title}`);

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
      address,
      city,
      state,
      country,
      zipCode,
      price,
      capacity,
      latitude,
      longitude,
      amenities,
      images,
      rules,
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
    if (address !== undefined) updateData.address = address ? address.trim() : null;
    if (city !== undefined) updateData.city = city ? city.trim() : null;
    if (state !== undefined) updateData.state = state ? state.trim() : null;
    if (country !== undefined) updateData.country = country ? country.trim() : null;
    if (zipCode !== undefined) updateData.zipCode = zipCode ? zipCode.trim() : null;
    if (rules !== undefined) updateData.rules = rules ? rules.trim() : null;
    
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
    if (amenities !== undefined) updateData.amenities = amenities;
    
    // Fix image URLs if images are being updated
    if (images !== undefined) {
      updateData.images = fixImageUrls(req, images);
    }
    
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

    console.log(`🏕️ Camping spot updated by user ${req.user.userId}: ${updatedSpot.title}`);

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