# 🏕️ CampingHub Backend

A comprehensive Node.js/Express backend for a camping spot booking platform, built with Prisma, MySQL, and JWT authentication.

## 🚀 Features

### 🔐 Authentication & Authorization
- JWT-based authentication
- Role-based access control (User, Owner, Admin)
- Secure password hashing with bcrypt
- Token validation middleware

### 🏕️ Camping Spot Management
- CRUD operations for camping spots
- Image upload and processing
- Location-based search
- Advanced filtering and search
- Owner-specific spot management

### 📅 Booking System
- Complete booking lifecycle
- Date validation and conflict detection
- Cancellation policy enforcement
- Booking history and management

### ⭐ Review System
- User reviews and ratings
- Verified booking reviews
- Average rating calculations

### 👥 User Management
- User profiles and authentication
- Owner and admin roles
- Account management

### 📊 Admin Panel
- Dashboard with statistics
- User and spot management
- Booking oversight
- Report generation

### 🔧 Technical Features
- Comprehensive error handling
- Request validation and sanitization
- File upload handling
- Email notifications
- Logging system
- API documentation

## 📋 Prerequisites

- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- npm or yarn
- Git

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/campinghub-backend.git
cd campinghub-backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your configuration
nano .env
```

### 4. Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed database with sample data
npx prisma db seed
```

### 5. Start Development Server
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Database
DATABASE_URL="mysql://username:password@localhost:3306/campingHub"

# Application
NODE_ENV=development
PORT=3000
FRONTEND_URL="http://localhost:8080"

# JWT
JWT_SECRET="your-super-secure-jwt-secret"
JWT_EXPIRES_IN="24h"

# Email (optional)
EMAIL_SERVICE="Gmail"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASSWORD="your-app-password"
EMAIL_FROM="CampingHub <noreply@campinghub.com>"
```

## 📁 Project Structure

```
campingHub-Backend/
├── 📁 bin/
│   └── www                    # Server startup script
├── 📁 config/
│   ├── constants.js          # Application constants
│   └── database.js           # Database configuration
├── 📁 middleware/
│   ├── auth.js               # Authentication middleware
│   ├── errorHandler.js       # Global error handling
│   ├── validation.js         # Request validation
│   └── logger.js             # Logging middleware
├── 📁 prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.js               # Database seeder
├── 📁 routes/
│   ├── index.js              # Main API routes
│   ├── users.js              # User authentication
│   ├── owners.js             # Owner-specific routes
│   ├── bookings.js           # Booking management
│   └── admin.js              # Admin routes
├── 📁 utils/
│   ├── helpers.js            # Utility functions
│   ├── emailService.js       # Email handling
│   └── imageUpload.js        # File upload handling
├── 📁 tests/
│   └── api.test.js           # API test suite
├── 📁 docs/
│   └── api.md                # API documentation
└── 📁 logs/                  # Application logs
```

## 🌐 API Endpoints

### Authentication
- `POST /api/users/register` - User registration
- `POST /api/users/login` - User login
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### Camping Spots
- `GET /api/spots` - Get all camping spots (with filters)
- `GET /api/spots/:id` - Get single camping spot
- `POST /api/owners/spots` - Create camping spot (owners only)
- `PUT /api/owners/spots/:id` - Update camping spot (owners only)
- `DELETE /api/owners/spots/:id` - Delete camping spot (owners only)

### Bookings
- `GET /api/bookings` - Get user's bookings
- `GET /api/bookings/:id` - Get single booking
- `POST /api/bookings` - Create new booking
- `PUT /api/bookings/:id/cancel` - Cancel booking
- `POST /api/bookings/:id/review` - Add review

### Admin
- `GET /api/admin/dashboard` - Admin dashboard
- `GET /api/admin/users` - Manage users
- `GET /api/admin/spots` - Manage camping spots
- `GET /api/admin/bookings` - Manage bookings

See [API Documentation](docs/api.md) for detailed endpoint specifications.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test tests/api.test.js
```

## 📦 Database Schema

### Main Entities

- **Users**: Authentication and profile management
- **CampingSpots**: Camping location details
- **Bookings**: Reservation management
- **Reviews**: User feedback system

### Key Relationships

- Users can own multiple camping spots (owners)
- Users can make multiple bookings
- Users can review spots they've booked
- Spots belong to owners and can have multiple bookings

## 🚀 Deployment

### Production Setup

1. **Environment Configuration**
```bash
NODE_ENV=production
DATABASE_URL="your-production-database-url"
JWT_SECRET="your-production-jwt-secret"
```

2. **Database Migration**
```bash
npx prisma migrate deploy
```

3. **Start Production Server**
```bash
npm start
```

### Docker Deployment

```bash
# Build Docker image
docker build -t campinghub-backend .

# Run container
docker run -p 3000:3000 --env-file .env campinghub-backend
```

## 📊 Monitoring and Logs

- Application logs are stored in the `logs/` directory
- Request/response logging for all API calls
- Error tracking and reporting
- Performance monitoring

## 🔒 Security Features

- JWT token authentication
- Password hashing with bcrypt
- Input validation and sanitization
- SQL injection prevention (Prisma)
- Rate limiting
- CORS configuration
- File upload restrictions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Development Guidelines

- Follow JavaScript ES6+ standards
- Use meaningful commit messages
- Write tests for new features
- Update documentation for API changes
- Follow the existing code structure

## ⚠️ Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check MySQL is running
   - Verify DATABASE_URL in .env
   - Ensure database exists

2. **JWT Token Errors**
   - Check JWT_SECRET in .env
   - Verify token format in requests

3. **File Upload Issues**
   - Check uploads directory permissions
   - Verify file size limits
   - Ensure allowed file types

### Support

For issues and questions:
- Create an issue on GitHub
- Check existing documentation
- Review API documentation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Backend Developer**: [Your Name]
- **Database Design**: [Your Name]
- **API Documentation**: [Your Name]

## 🎯 Roadmap

### Upcoming Features
- [ ] Payment integration (Stripe)
- [ ] Real-time chat system
- [ ] Mobile app API enhancements
- [ ] Advanced analytics
- [ ] Multi-language support
- [ ] Social media integration

### Version History
- **v1.0.0** - Initial release with core features
- **v1.1.0** - Admin panel and enhanced validation
- **v1.2.0** - File upload and email notifications

---

## 🏗️ Built With

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Prisma** - Database ORM
- **MySQL** - Database
- **JWT** - Authentication
- **Multer** - File uploads
- **Nodemailer** - Email service
- **Sharp** - Image processing
- **Jest** - Testing framework

---

Made with ❤️ for the camping community