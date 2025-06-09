const { PrismaClient } = require('@prisma/client');

class DatabaseConfig {
  constructor() {
    this.prisma = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 5;
  }

  async connect() {
    try {
      if (this.prisma && this.isConnected) {
        return this.prisma;
      }

      this.prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        errorFormat: 'pretty',
        datasources: {
          db: {
            url: process.env.DATABASE_URL
          }
        }
      });

      // Test the connection with retry mechanism
      await this.testConnection();
      
      this.isConnected = true;
      this.connectionAttempts = 0;
      console.log('✅ Database connected successfully');
      
      return this.prisma;
      
    } catch (error) {
      this.connectionAttempts++;
      console.error(`❌ Database connection failed (attempt ${this.connectionAttempts}):`, error.message);
      this.isConnected = false;
      
      if (this.connectionAttempts < this.maxRetries) {
        console.log(`🔄 Retrying database connection in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.connect();
      }
      
      throw error;
    }
  }

  async testConnection() {
    try {
      await this.prisma.$connect();
      // Test with a simple query
      await this.prisma.$queryRaw`SELECT 1 as test`;
      return true;
    } catch (error) {
      if (this.prisma) {
        await this.prisma.$disconnect().catch(() => {});
      }
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.prisma) {
        await this.prisma.$disconnect();
        this.isConnected = false;
        this.prisma = null;
        console.log('📡 Database disconnected');
      }
    } catch (error) {
      console.error('❌ Error disconnecting from database:', error.message);
    }
  }

  getInstance() {
    if (!this.prisma || !this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.prisma;
  }

  async healthCheck() {
    try {
      if (!this.prisma || !this.isConnected) {
        return { status: 'disconnected', message: 'Database not connected' };
      }
      
      await this.prisma.$queryRaw`SELECT 1 as health_check`;
      return { status: 'healthy', message: 'Database connection is healthy' };
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  }

  // Handle connection drops and reconnect
  async ensureConnection() {
    try {
      if (!this.isConnected || !this.prisma) {
        console.log('🔄 Database connection lost, attempting to reconnect...');
        return await this.connect();
      }
      
      // Test if connection is still alive
      await this.prisma.$queryRaw`SELECT 1`;
      return this.prisma;
    } catch (error) {
      console.log('🔄 Database connection test failed, reconnecting...');
      this.isConnected = false;
      return await this.connect();
    }
  }
}

// Create singleton instance
const database = new DatabaseConfig();

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Disconnecting database...`);
  await database.disconnect();
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught Exception:', error);
  await database.disconnect();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  await database.disconnect();
  process.exit(1);
});

module.exports = database;