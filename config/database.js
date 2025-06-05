const { PrismaClient } = require('@prisma/client');

class DatabaseConfig {
  constructor() {
    this.prisma = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      if (this.prisma && this.isConnected) {
        return this.prisma;
      }

      this.prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error'] : ['error']
      });

      // Test the connection
      await this.prisma.$connect();
      await this.prisma.$queryRaw`SELECT 1`;
      
      this.isConnected = true;
      console.log('✅ Database connected successfully');
      
      return this.prisma;
      
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      this.isConnected = false;
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
}

// Create singleton instance
const database = new DatabaseConfig();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Disconnecting database...');
  await database.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Disconnecting database...');
  await database.disconnect();
  process.exit(0);
});

module.exports = database;