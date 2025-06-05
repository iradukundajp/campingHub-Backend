# 📖 CampingHub API Documentation

Base URL: `http://localhost:3000/api`

## 🔐 Authentication

All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## 📋 Response Format

All API responses follow this standard format:

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "timestamp": "2025-06-05T15:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed error messages"],
  "timestamp": "2025-06-05T15:00:00.000Z"
}
```

## 🏠 General Endpoints

### Health Check
```http
GET /api/
```

**Response:**
```json
{
  "message": "CampingHub API is running!",
  "version": "1.0.0",
  "endpoints": {
    "auth": "/api/users",
    "spots": "/api/spots",
    "bookings": "/api/bookings"
  }
}
```

### Database Test
```http
GET /api/test-db
```

**Response:**
```json
{
  "message": "Database connection successful!",
  "stats": {
    "users": 10,
    "campingSpots": 5,
    "bookings": 3
  }
}
```

## 👤 User Authentication & Management

### Register User
```http
POST /api/users/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1-555-0123",
  "role": "USER"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "createdAt": "2025-06-05T15:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Login User
```http
POST /api/users/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Get User Profile
```http
GET /api/users/profile
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1-555-0123",
    "role": "USER",
    "createdAt": "2025-06-05T15:00:00.000Z",
    "updatedAt": "2025-06-05T15:00:00.000Z"
  }
}
```

### Update User Profile
```http
PUT /api/users/profile
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com"
}
```

### Change Password
```http
PUT /api/users/change-password
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

### Get User Bookings
```http
GET /api/users/bookings
Authorization: Bearer <token>
```

### Logout
```http
POST /api/users/logout
Authorization: Bearer <token>
```

### Verify Token
```http
GET /api/users/verify-token
Authorization: Bearer <token>
```

## 🏕️ Camping Spots

### Get All Camping Spots
```http
GET /api/spots?search=mountain&location=colorado&minPrice=30&maxPrice=100&capacity=4&page=1&limit=10
```

**Query Parameters:**
- `search` (string): Search in title, description, location
- `location` (string): Filter by location
- `minPrice` (number): Minimum price per night
- `maxPrice` (number): Maximum price per night
- `capacity` (number): Minimum capacity
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10, max: 100)

**Response (200):**
```json
{
  "spots": [
    {
      "id": 1,
      "title": "Mountain View Campground",
      "description": "Beautiful mountain views...",
      "location": "Rocky Mountain National Park, Colorado",
      "price": "45.00",
      "capacity": 6,
      "images": ["url1", "url2"],
      "amenities": ["Fire pit", "Water access"],
      "isActive": true,
      "averageRating": 4.5,
      "totalReviews": 12,
      "totalBookings": 25,
      "owner": {
        "id": 2,
        "firstName": "John",
        "lastName": "Owner"
      },
      "createdAt": "2025-06-05T15:00:00.000Z"
    }
  ],
  "total": 1
}
```

### Get Single Camping Spot
```http
GET /api/spots/:id
```

**Response (200):**
```json
{
  "id": 1,
  "title": "Mountain View Campground",
  "description": "Beautiful mountain views...",
  "location": "Rocky Mountain National Park, Colorado",
  "address": "123 Mountain View Rd",
  "city": "Estes Park",
  "state": "Colorado",
  "zipCode": "80517",
  "latitude": 40.3428,
  "longitude": -105.6836,
  "price": "45.00",
  "capacity": 6,
  "amenities": ["Fire pit", "Water access"],
  "images": ["url1", "url2"],
  "rules": "No loud music after 10 PM",
  "isActive": true,
  "averageRating": 4.5,
  "totalReviews": 12,
  "owner": {
    "id": 2,
    "firstName": "John",
    "lastName": "Owner",
    "email": "owner@example.com"
  },
  "reviews": [
    {
      "id": 1,
      "rating": 5,
      "comment": "Amazing experience!",
      "user": {
        "firstName": "Jane",
        "lastName": "Doe"
      },
      "createdAt": "2025-06-05T15:00:00.000Z"
    }
  ],
  "bookings": [
    {
      "checkIn": "2025-07-15T00:00:00.000Z",
      "checkOut": "2025-07-18T00:00:00.000Z"
    }
  ]
}
```

## 🏠 Owner Routes

### Get Owner's Camping Spots
```http
GET /api/owners/spots
Authorization: Bearer <owner_token>
```

### Create Camping Spot
```http
POST /api/owners/spots
Authorization: Bearer <owner_token>
```

**Request Body:**
```json
{
  "title": "Lakeside Retreat",
  "description": "Peaceful lakeside camping with fishing opportunities",
  "location": "Lake Tahoe, California",
  "address": "456 Lakeside Dr",
  "city": "South Lake Tahoe",
  "state": "California",
  "zipCode": "96150",
  "latitude": 38.9402,
  "longitude": -119.9772,
  "price": 60.00,
  "capacity": 8,
  "amenities": ["Lake access", "Boat dock", "Fire pit"],
  "images": ["image_url_1", "image_url_2"],
  "rules": "Quiet hours from 10 PM to 7 AM"
}
```

**Response (201):**
```json
{
  "message": "Camping spot created successfully",
  "spot": {
    "id": 2,
    "title": "Lakeside Retreat",
    "description": "Peaceful lakeside camping...",
    "location": "Lake Tahoe, California",
    "price": "60.00",
    "capacity": 8,
    "ownerId": 2,
    "isActive": true,
    "createdAt": "2025-06-05T15:00:00.000Z"
  }
}
```

### Update Camping Spot
```http
PUT /api/owners/spots/:id
Authorization: Bearer <owner_token>
```

**Request Body:**
```json
{
  "title": "Updated Lakeside Retreat",
  "price": 65.00,
  "isActive": false
}
```

### Delete Camping Spot
```http
DELETE /api/owners/spots/:id
Authorization: Bearer <owner_token>
```

### Get Owner's Bookings
```http
GET /api/owners/bookings
Authorization: Bearer <owner_token>
```

**Response (200):**
```json
{
  "bookings": [
    {
      "id": 1,
      "checkIn": "2025-07-15T00:00:00.000Z",
      "checkOut": "2025-07-18T00:00:00.000Z",
      "guests": 4,
      "totalPrice": "135.00",
      "status": "CONFIRMED",
      "user": {
        "id": 1,
        "firstName": "Jane",
        "lastName": "Doe",
        "email": "jane@example.com"
      },
      "spot": {
        "id": 1,
        "title": "Mountain View Campground",
        "location": "Rocky Mountain National Park, Colorado"
      }
    }
  ],
  "total": 1
}
```

## 📅 Bookings

### Get User's Bookings
```http
GET /api/bookings
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "bookings": [
    {
      "id": 1,
      "checkIn": "2025-07-15T00:00:00.000Z",
      "checkOut": "2025-07-18T00:00:00.000Z",
      "guests": 4,
      "totalPrice": "135.00",
      "status": "CONFIRMED",
      "paymentStatus": "PAID",
      "notes": "Arriving late on check-in day",
      "spot": {
        "id": 1,
        "title": "Mountain View Campground",
        "location": "Rocky Mountain National Park, Colorado",
        "price": "45.00",
        "images": ["url1"]
      },
      "createdAt": "2025-06-05T15:00:00.000Z"
    }
  ],
  "total": 1
}
```

### Get Single Booking
```http
GET /api/bookings/:id
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "booking": {
    "id": 1,
    "checkIn": "2025-07-15T00:00:00.000Z",
    "checkOut": "2025-07-18T00:00:00.000Z",
    "guests": 4,
    "totalPrice": "135.00",
    "status": "CONFIRMED",
    "paymentStatus": "PAID",
    "notes": "Arriving late",
    "spot": {
      "id": 1,
      "title": "Mountain View Campground",
      "location": "Rocky Mountain National Park, Colorado",
      "address": "123 Mountain View Rd",
      "price": "45.00",
      "capacity": 6,
      "amenities": ["Fire pit", "Water access"],
      "images": ["url1", "url2"],
      "owner": {
        "firstName": "John",
        "lastName": "Owner",
        "email": "owner@example.com"
      }
    },
    "createdAt": "2025-06-05T15:00:00.000Z"
  }
}
```

### Create Booking
```http
POST /api/bookings
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "spotId": 1,
  "checkIn": "2025-08-01",
  "checkOut": "2025-08-05",
  "guests": 4,
  "notes": "First time camping here!"
}
```

**Response (201):**
```json
{
  "message": "Booking created successfully",
  "booking": {
    "id": 2,
    "userId": 1,
    "spotId": 1,
    "checkIn": "2025-08-01T00:00:00.000Z",
    "checkOut": "2025-08-05T00:00:00.000Z",
    "guests": 4,
    "totalPrice": "240.00",
    "status": "CONFIRMED",
    "paymentStatus": "PENDING",
    "notes": "First time camping here!",
    "spot": {
      "id": 1,
      "title": "Mountain View Campground",
      "location": "Rocky Mountain National Park, Colorado",
      "price": "60.00"
    },
    "user": {
      "id": 1,
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@example.com"
    },
    "createdAt": "2025-06-05T15:00:00.000Z"
  }
}
```

### Cancel Booking
```http
PUT /api/bookings/:id/cancel
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "Booking cancelled successfully",
  "booking": {
    "id": 1,
    "status": "CANCELLED",
    "spot": {
      "id": 1,
      "title": "Mountain View Campground",
      "location": "Rocky Mountain National Park, Colorado"
    }
  }
}
```

### Add Review
```http
POST /api/bookings/:id/review
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "rating": 5,
  "comment": "Amazing camping experience! Beautiful views and great facilities."
}
```

**Response (201):**
```json
{
  "message": "Review added successfully",
  "review": {
    "id": 1,
    "userId": 1,
    "spotId": 1,
    "rating": 5,
    "comment": "Amazing camping experience!",
    "isVerified": true,
    "spot": {
      "id": 1,
      "title": "Mountain View Campground"
    },
    "createdAt": "2025-06-05T15:00:00.000Z"
  }
}
```

## 👨‍💼 Admin Routes

### Admin Dashboard
```http
GET /api/admin/dashboard
Authorization: Bearer <admin_token>
```

**Response (200):**
```json
{
  "message": "Dashboard data retrieved successfully",
  "dashboard": {
    "overview": {
      "totalUsers": 150,
      "totalOwners": 25,
      "totalSpots": 75,
      "activeSpots": 68,
      "totalBookings": 320,
      "totalRevenue": "15750.00"
    },
    "recentActivity": {
      "recentUsers": [...],
      "recentBookings": [...]
    },
    "monthlyStats": [...]
  }
}
```

### Manage Users
```http
GET /api/admin/users?search=john&role=USER&page=1&limit=20
Authorization: Bearer <admin_token>
```

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+1-555-0123",
      "role": "USER",
      "isActive": true,
      "isVerified": true,
      "createdAt": "2025-06-05T15:00:00.000Z",
      "_count": {
        "ownedSpots": 0,
        "bookings": 3,
        "reviews": 2
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Update User Status
```http
PUT /api/admin/users/:id
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "isActive": false,
  "role": "OWNER",
  "isVerified": true
}
```

### Manage Camping Spots
```http
GET /api/admin/spots?search=mountain&page=1&limit=20
Authorization: Bearer <admin_token>
```

### Update Spot Status
```http
PUT /api/admin/spots/:id
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "isActive": false
}
```

### Manage Bookings
```http
GET /api/admin/bookings?status=CONFIRMED&page=1&limit=20
Authorization: Bearer <admin_token>
```

### Generate Reports
```http
GET /api/admin/reports?type=revenue&startDate=2025-01-01&endDate=2025-12-31
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `type`: revenue, users, bookings
- `startDate`: Start date for report (YYYY-MM-DD)
- `endDate`: End date for report (YYYY-MM-DD)

### Delete User
```http
DELETE /api/admin/users/:id
Authorization: Bearer <admin_token>
```

## 🚨 Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid request data |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation error |
| 500 | Internal Server Error - Server error |

## 📝 Data Models

### User
```json
{
  "id": 1,
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1-555-0123",
  "avatar": "https://example.com/avatar.jpg",
  "role": "USER|OWNER|ADMIN",
  "isActive": true,
  "isVerified": false,
  "createdAt": "2025-06-05T15:00:00.000Z",
  "updatedAt": "2025-06-05T15:00:00.000Z"
}
```

### Camping Spot
```json
{
  "id": 1,
  "title": "Mountain View Campground",
  "description": "Beautiful mountain views...",
  "location": "Rocky Mountain National Park, Colorado",
  "address": "123 Mountain View Rd",
  "city": "Estes Park",
  "state": "Colorado",
  "country": "USA",
  "zipCode": "80517",
  "latitude": 40.3428,
  "longitude": -105.6836,
  "price": "45.00",
  "capacity": 6,
  "amenities": ["Fire pit", "Water access"],
  "images": ["url1", "url2"],
  "rules": "No loud music after 10 PM",
  "isActive": true,
  "isInstantBook": false,
  "ownerId": 2,
  "createdAt": "2025-06-05T15:00:00.000Z",
  "updatedAt": "2025-06-05T15:00:00.000Z"
}
```

### Booking
```json
{
  "id": 1,
  "userId": 1,
  "spotId": 1,
  "checkIn": "2025-07-15T00:00:00.000Z",
  "checkOut": "2025-07-18T00:00:00.000Z",
  "guests": 4,
  "totalPrice": "135.00",
  "status": "PENDING|CONFIRMED|CANCELLED|COMPLETED|REFUNDED",
  "paymentStatus": "PENDING|PAID|FAILED|REFUNDED",
  "notes": "Special requests or notes",
  "createdAt": "2025-06-05T15:00:00.000Z",
  "updatedAt": "2025-06-05T15:00:00.000Z"
}
```

### Review
```json
{
  "id": 1,
  "userId": 1,
  "spotId": 1,
  "rating": 5,
  "comment": "Amazing experience!",
  "isVerified": true,
  "createdAt": "2025-06-05T15:00:00.000Z",
  "updatedAt": "2025-06-05T15:00:00.000Z"
}
```

## 🔧 Rate Limiting

- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 login attempts per 15 minutes per IP
- **File uploads**: 10 uploads per hour per user

## 📤 File Upload

### Image Upload for Camping Spots
```http
POST /api/owners/spots/:id/images
Authorization: Bearer <owner_token>
Content-Type: multipart/form-data
```

**Form Data:**
- `images`: Image files (max 10 files, 5MB each)
- Allowed formats: JPG, JPEG, PNG, GIF

**Response (200):**
```json
{
  "message": "Images uploaded successfully",
  "images": [
    {
      "url": "/uploads/images/processed_filename.jpg",
      "thumbnailUrl": "/uploads/thumbnails/thumb_filename.jpg"
    }
  ]
}
```

## 📬 Email Notifications

The API automatically sends emails for:
- Welcome message (new user registration)
- Booking confirmation
- Booking cancellation
- Review reminders
- New booking notifications (to owners)

## 🧪 Testing

### Example cURL Commands

**Register User:**
```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Get Camping Spots:**
```bash
curl -X GET "http://localhost:3000/api/spots?search=mountain&minPrice=30&maxPrice=100"
```

**Create Booking:**
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "spotId": 1,
    "checkIn": "2025-08-01",
    "checkOut": "2025-08-05",
    "guests": 4
  }'
```

---

For more information, see the main [README.md](../README.md) file.