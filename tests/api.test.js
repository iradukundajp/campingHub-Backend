const request = require('supertest');
const app = require('../app');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'password123',
  firstName: 'Test',
  lastName: 'User'
};

const testOwner = {
  email: 'owner@example.com',
  password: 'password123',
  firstName: 'Test',
  lastName: 'Owner',
  role: 'OWNER'
};

const testSpot = {
  title: 'Test Camping Spot',
  description: 'A beautiful camping spot for testing purposes',
  location: 'Test Location, State',
  price: 50.00,
  capacity: 4
};

let userToken = '';
let ownerToken = '';
let spotId = 0;
let bookingId = 0;

describe('CampingHub API Tests', () => {
  
  beforeAll(async () => {
    // Clean up test data
    await prisma.booking.deleteMany({ where: { user: { email: { contains: 'test' } } } });
    await prisma.review.deleteMany({ where: { user: { email: { contains: 'test' } } } });
    await prisma.campingSpot.deleteMany({ where: { owner: { email: { contains: 'test' } } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test' } } });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.booking.deleteMany({ where: { user: { email: { contains: 'test' } } } });
    await prisma.review.deleteMany({ where: { user: { email: { contains: 'test' } } } });
    await prisma.campingSpot.deleteMany({ where: { owner: { email: { contains: 'test' } } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test' } } });
    await prisma.$disconnect();
  });

  describe('Health Check', () => {
    test('GET /api/ should return API info', async () => {
      const response = await request(app)
        .get('/api/')
        .expect(200);

      expect(response.body.message).toBe('CampingHub API is running!');
      expect(response.body.version).toBe('1.0.0');
    });

    test('GET /api/test-db should return database stats', async () => {
      const response = await request(app)
        .get('/api/test-db')
        .expect(200);

      expect(response.body.message).toBe('Database connection successful!');
      expect(response.body.stats).toHaveProperty('users');
      expect(response.body.stats).toHaveProperty('campingSpots');
      expect(response.body.stats).toHaveProperty('bookings');
    });
  });

  describe('User Authentication', () => {
    test('POST /api/users/register should create a new user', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send(testUser)
        .expect(201);

      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.token).toBeDefined();
      userToken = response.body.token;
    });

    test('POST /api/users/register should create an owner', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send(testOwner)
        .expect(201);

      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.user.role).toBe('OWNER');
      expect(response.body.token).toBeDefined();
      ownerToken = response.body.token;
    });

    test('POST /api/users/register should reject duplicate email', async () => {
      await request(app)
        .post('/api/users/register')
        .send(testUser)
        .expect(409);
    });

    test('POST /api/users/login should authenticate user', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.message).toBe('Login successful');
      expect(response.body.token).toBeDefined();
    });

    test('POST /api/users/login should reject invalid credentials', async () => {
      await request(app)
        .post('/api/users/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);
    });

    test('GET /api/users/profile should return user profile', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.firstName).toBe(testUser.firstName);
    });

    test('GET /api/users/profile should require authentication', async () => {
      await request(app)
        .get('/api/users/profile')
        .expect(401);
    });
  });

  describe('Camping Spots', () => {
    test('GET /api/spots should return camping spots', async () => {
      const response = await request(app)
        .get('/api/spots')
        .expect(200);

      expect(response.body.spots).toBeDefined();
      expect(Array.isArray(response.body.spots)).toBe(true);
    });

    test('POST /api/owners/spots should create camping spot', async () => {
      const response = await request(app)
        .post('/api/owners/spots')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(testSpot)
        .expect(201);

      expect(response.body.message).toBe('Camping spot created successfully');
      expect(response.body.spot.title).toBe(testSpot.title);
      spotId = response.body.spot.id;
    });

    test('POST /api/owners/spots should require owner role', async () => {
      await request(app)
        .post('/api/owners/spots')
        .set('Authorization', `Bearer ${userToken}`)
        .send(testSpot)
        .expect(403);
    });

    test('GET /api/spots/:id should return single spot', async () => {
      const response = await request(app)
        .get(`/api/spots/${spotId}`)
        .expect(200);

      expect(response.body.title).toBe(testSpot.title);
      expect(response.body.location).toBe(testSpot.location);
    });

    test('PUT /api/owners/spots/:id should update spot', async () => {
      const updatedData = { title: 'Updated Test Spot' };
      
      const response = await request(app)
        .put(`/api/owners/spots/${spotId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(updatedData)
        .expect(200);

      expect(response.body.spot.title).toBe(updatedData.title);
    });

    test('GET /api/owners/spots should return owner spots', async () => {
      const response = await request(app)
        .get('/api/owners/spots')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.spots).toBeDefined();
      expect(response.body.spots.length).toBeGreaterThan(0);
    });
  });

  describe('Bookings', () => {
    const bookingData = {
      spotId: 0, // Will be set in test
      checkIn: '2025-08-01',
      checkOut: '2025-08-03',
      guests: 2
    };

    test('POST /api/bookings should create booking', async () => {
      bookingData.spotId = spotId;
      
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send(bookingData)
        .expect(201);

      expect(response.body.message).toBe('Booking created successfully');
      expect(response.body.booking.spotId).toBe(spotId);
      bookingId = response.body.booking.id;
    });

    test('POST /api/bookings should require authentication', async () => {
      await request(app)
        .post('/api/bookings')
        .send(bookingData)
        .expect(401);
    });

    test('POST /api/bookings should validate dates', async () => {
      const invalidBooking = {
        ...bookingData,
        checkIn: '2025-08-03',
        checkOut: '2025-08-01' // Check-out before check-in
      };

      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidBooking)
        .expect(400);
    });

    test('GET /api/bookings should return user bookings', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.bookings).toBeDefined();
      expect(response.body.bookings.length).toBeGreaterThan(0);
    });

    test('GET /api/bookings/:id should return single booking', async () => {
      const response = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.booking.id).toBe(bookingId);
    });

    test('PUT /api/bookings/:id/cancel should cancel booking', async () => {
      const response = await request(app)
        .put(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.message).toBe('Booking cancelled successfully');
      expect(response.body.booking.status).toBe('CANCELLED');
    });
  });

  describe('Search and Filters', () => {
    test('GET /api/spots with search parameter', async () => {
      const response = await request(app)
        .get('/api/spots?search=test')
        .expect(200);

      expect(response.body.spots).toBeDefined();
      // Should find our test spot
      const foundSpot = response.body.spots.find(spot => spot.id === spotId);
      expect(foundSpot).toBeDefined();
    });

    test('GET /api/spots with price filter', async () => {
      const response = await request(app)
        .get('/api/spots?minPrice=30&maxPrice=60')
        .expect(200);

      expect(response.body.spots).toBeDefined();
      response.body.spots.forEach(spot => {
        expect(parseFloat(spot.price)).toBeGreaterThanOrEqual(30);
        expect(parseFloat(spot.price)).toBeLessThanOrEqual(60);
      });
    });

    test('GET /api/spots with capacity filter', async () => {
      const response = await request(app)
        .get('/api/spots?capacity=4')
        .expect(200);

      expect(response.body.spots).toBeDefined();
      response.body.spots.forEach(spot => {
        expect(spot.capacity).toBeGreaterThanOrEqual(4);
      });
    });
  });

  describe('Input Validation', () => {
    test('should reject invalid email format', async () => {
      await request(app)
        .post('/api/users/register')
        .send({
          ...testUser,
          email: 'invalid-email'
        })
        .expect(400);
    });

    test('should reject short password', async () => {
      await request(app)
        .post('/api/users/register')
        .send({
          ...testUser,
          email: 'new@test.com',
          password: '123'
        })
        .expect(400);
    });

    test('should reject negative price', async () => {
      await request(app)
        .post('/api/owners/spots')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          ...testSpot,
          price: -10
        })
        .expect(400);
    });

    test('should reject zero capacity', async () => {
      await request(app)
        .post('/api/owners/spots')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          ...testSpot,
          capacity: 0
        })
        .expect(400);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent spot', async () => {
      await request(app)
        .get('/api/spots/99999')
        .expect(404);
    });

    test('should return 404 for non-existent booking', async () => {
      await request(app)
        .get('/api/bookings/99999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    test('should handle malformed JSON', async () => {
      await request(app)
        .post('/api/users/register')
        .send('invalid json')
        .expect(400);
    });
  });
});

// Helper function to run tests
if (require.main === module) {
  console.log('Running tests...');
  console.log('Make sure your test database is set up and the server is running.');
}