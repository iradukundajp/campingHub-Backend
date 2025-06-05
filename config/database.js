const { PrismaClient } = require('@prisma/client');

// Database configuration and connection
class DatabaseConfig {
  constructor() {
    this.prisma = null;
    this.isConnected = false;
  }

  // Initialize database connection
  async connect() {
    try {
      this.prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
        errorFormat: 'pretty',
      });

      // Test the connection
      await this.prisma.$connect();
      this.isConnected = true;
      
      console.log('✅ Database connected successfully');
      return this.prisma;
      
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  // Disconnect from database
  async disconnect() {
    try {
      if (this.prisma) {
        await this.prisma.$disconnect();
        this.isConnected = false;
        console.log('📡 Database disconnected');
      }
    } catch (error) {
      console.error('Error disconnecting from database:', error);
    }
  }

  // Get database instance
  getInstance() {
    if (!this.prisma || !this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.prisma;
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.prisma) {
        return { status: 'disconnected', message: 'Database not initialized' };
      }

      // Simple query to test connection
      await this.prisma.$queryRaw`SELECT 1`;
      
      return { 
        status: 'connected', 
        message: 'Database is healthy',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { 
        status: 'error', 
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Get database statistics
  async getStats() {
    try {
      const [userCount, spotCount, bookingCount, reviewCount] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.campingSpot.count(),
        this.prisma.booking.count(),
        this.prisma.review.count()
      ]);

      return {
        users: userCount,
        campingSpots: spotCount,
        bookings: bookingCount,
        reviews: reviewCount,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching database stats:', error);
      throw error;
    }
  }

  // Clean up expired tokens or temporary data
  async cleanup() {
    try {
      // Add any cleanup operations here
      // For example, delete expired sessions, temporary files, etc.
      console.log('🧹 Database cleanup completed');
    } catch (error) {
      console.error('Error during database cleanup:', error);
    }
  }
}

// Create singleton instance
const database = new DatabaseConfig();

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Graceful shutdown...');
  await database.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
  await database.disconnect();
  process.exit(0);
});

module.exports = database;