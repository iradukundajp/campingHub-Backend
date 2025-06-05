var express = require('express');
var router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');

// Simple validation helpers
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePassword = (password) => password && password.length >= 6;

/* GET /api/users - API info */
router.get('/', function(req, res, next) {
  res.json({
    message: 'CampingHub Users API',
    version: '1.0.0',
    endpoints: {
      register: 'POST /api/users/register',
      login: 'POST /api/users/login',
      profile: 'GET /api/users/profile (requires auth)',
      updateProfile: 'PUT /api/users/profile (requires auth)',
      bookings: 'GET /api/users/bookings (requires auth)'
    }
  });
});

/* POST /api/users/register - User Registration */
router.post('/register', async function(req, res, next) {
  try {
    const { email, password, firstName, lastName, role = 'USER' } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        message: 'All required fields must be provided'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        message: 'Please provide a valid email address'
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters long'
      });
    }

    // Validate role
    const validRoles = ['USER', 'OWNER', 'ADMIN'];
    const userRole = role.toUpperCase();
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({
        message: 'Invalid role. Must be USER, OWNER, or ADMIN'
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
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: userRole,
        isActive: true,
        isVerified: true
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      message: 'Error registering user'
    });
  }
});

/* POST /api/users/login - User Login */
router.post('/login', async function(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required'
      });
    }

    // Find user
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

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return user info (without password)
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Error during login'
    });
  }
});

/* GET /api/users/profile - Get User Profile */
router.get('/profile', authenticateToken, async function(req, res, next) {
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            bookings: true,
            ownedSpots: true
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
      message: 'Profile retrieved successfully',
      user 
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      message: 'Error fetching profile'
    });
  }
});

/* PUT /api/users/profile - Update User Profile */
router.put('/profile', authenticateToken, async function(req, res, next) {
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
      if (!validateEmail(email)) {
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
      message: 'Error updating profile'
    });
  }
});

/* GET /api/users/bookings - Get User's Bookings */
router.get('/bookings', authenticateToken, async function(req, res, next) {
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

    // Parse JSON fields
    const bookingsWithParsedData = bookings.map(booking => ({
      ...booking,
      spot: {
        ...booking.spot,
        images: booking.spot.images ? 
          (typeof booking.spot.images === 'string' ? 
            JSON.parse(booking.spot.images) : booking.spot.images) : []
      }
    }));

    res.json({ 
      message: 'Bookings retrieved successfully',
      bookings: bookingsWithParsedData
    });

  } catch (error) {
    console.error('Bookings fetch error:', error);
    res.status(500).json({
      message: 'Error fetching bookings'
    });
  }
});

module.exports = router;