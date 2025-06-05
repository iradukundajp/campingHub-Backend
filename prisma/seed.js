const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Upsert admin user (won't fail if exists)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@campinghub.com' },
    update: {}, // Don't update if exists
    create: {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@campinghub.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'ADMIN',
      isVerified: true,
      isActive: true
    }
  });
  console.log('✅ Admin user created: admin@campinghub.com');

  // Upsert owner users
  const ownerUser1 = await prisma.user.upsert({
    where: { email: 'john.owner@campinghub.com' },
    update: {},
    create: {
      firstName: 'John',
      lastName: 'Owner',
      email: 'john.owner@campinghub.com',
      password: await bcrypt.hash('password123', 10),
      role: 'OWNER',
      isVerified: true,
      isActive: true
    }
  });

  const ownerUser2 = await prisma.user.upsert({
    where: { email: 'jane.manager@campinghub.com' },
    update: {},
    create: {
      firstName: 'Jane',
      lastName: 'Manager',
      email: 'jane.manager@campinghub.com',
      password: await bcrypt.hash('password123', 10),
      role: 'OWNER',
      isVerified: true,
      isActive: true
    }
  });
  console.log('✅ Owner users created');

  // Upsert regular users
  const regularUser1 = await prisma.user.upsert({
    where: { email: 'user1@campinghub.com' },
    update: {},
    create: {
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'user1@campinghub.com',
      password: await bcrypt.hash('password123', 10),
      role: 'USER',
      isVerified: true,
      isActive: true
    }
  });

  const regularUser2 = await prisma.user.upsert({
    where: { email: 'user2@campinghub.com' },
    update: {},
    create: {
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'user2@campinghub.com',
      password: await bcrypt.hash('password123', 10),
      role: 'USER',
      isVerified: true,
      isActive: true
    }
  });

  const regularUser3 = await prisma.user.upsert({
    where: { email: 'user3@campinghub.com' },
    update: {},
    create: {
      firstName: 'Charlie',
      lastName: 'Brown',
      email: 'user3@campinghub.com',
      password: await bcrypt.hash('password123', 10),
      role: 'USER',
      isVerified: true,
      isActive: true
    }
  });

  const regularUser4 = await prisma.user.upsert({
    where: { email: 'user4@campinghub.com' },
    update: {},
    create: {
      firstName: 'Diana',
      lastName: 'Wilson',
      email: 'user4@campinghub.com',
      password: await bcrypt.hash('password123', 10),
      role: 'USER',
      isVerified: true,
      isActive: true
    }
  });

  const regularUser5 = await prisma.user.upsert({
    where: { email: 'user5@campinghub.com' },
    update: {},
    create: {
      firstName: 'Eva',
      lastName: 'Martinez',
      email: 'user5@campinghub.com',
      password: await bcrypt.hash('password123', 10),
      role: 'USER',
      isVerified: true,
      isActive: true
    }
  });
  console.log('✅ Regular users created');

  // Belgian camping spots (Check if exists first, then create)
  let campingSpot1 = await prisma.campingSpot.findFirst({
    where: { 
      title: 'Premium Family Camping in Blankenberge',
      location: 'Blankenberge, West Flanders'
    }
  });
  
  if (!campingSpot1) {
    campingSpot1 = await prisma.campingSpot.create({
      data: {
        title: 'Premium Family Camping in Blankenberge',
        description: 'Peaceful family camping in the beautiful Belgian Ardennes. Perfect for hiking and cycling with kids playground and modern facilities.',
        location: 'Blankenberge, West Flanders',
        latitude: 51.3126,
        longitude: 3.1331,
        price: 45.00,
        capacity: 150,
        amenities: ['WiFi', 'Swimming Pool', 'Restaurant', 'Kids Playground', 'Bike Rental'],
        images: ['https://images.unsplash.com/photo-1537565732928-b40742e70295?w=800'],
        isActive: true,
        ownerId: ownerUser1.id
      }
    });
  }

  let campingSpot2 = await prisma.campingSpot.findFirst({
    where: { 
      title: 'Adventure Camping in the Belgian Ardennes',
      location: 'Durbuy, Luxembourg Province'
    }
  });
  
  if (!campingSpot2) {
    campingSpot2 = await prisma.campingSpot.create({
      data: {
        title: 'Adventure Camping in the Belgian Ardennes',
        description: 'Experience the wild beauty of the Belgian Ardennes. Mountain biking, hiking trails, and cozy campfire evenings await.',
        location: 'Durbuy, Luxembourg Province',
        latitude: 50.3531,
        longitude: 5.4562,
        price: 35.00,
        capacity: 80,
        amenities: ['WiFi', 'Hiking Trails', 'Mountain Biking', 'Campfire Area', 'Forest Location'],
        images: ['https://images.unsplash.com/photo-1487730116645-74489c95b41b?w=800'],
        isActive: true,
        ownerId: ownerUser2.id
      }
    });
  }

  let campingSpot3 = await prisma.campingSpot.findFirst({
    where: { 
      title: 'Lakeside Camping with Water Sports',
      location: 'Lommel, Limburg'
    }
  });
  
  if (!campingSpot3) {
    campingSpot3 = await prisma.campingSpot.create({
      data: {
        title: 'Lakeside Camping with Water Sports',
        description: 'Beautiful lakeside camping in Lommel. Known for excellent water sports, sandy beaches, and family-friendly atmosphere.',
        location: 'Lommel, Limburg',
        latitude: 51.2294,
        longitude: 5.3142,
        price: 38.50,
        capacity: 200,
        amenities: ['WiFi', 'Lake Access', 'Water Sports', 'Sandy Beach', 'Restaurant', 'Kids Club'],
        images: ['https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=800'],
        isActive: true,
        ownerId: ownerUser1.id
      }
    });
  }

  let campingSpot4 = await prisma.campingSpot.findFirst({
    where: { 
      title: 'Peaceful Coastal Camping Near Bruges',
      location: 'Bredene, West Flanders'
    }
  });
  
  if (!campingSpot4) {
    campingSpot4 = await prisma.campingSpot.create({
      data: {
        title: 'Peaceful Coastal Camping Near Bruges',
        description: 'Charming small-scale camping near the Belgian coast. Perfect for a quiet getaway with easy access to Ostend and Bruges.',
        location: 'Bredene, West Flanders',
        latitude: 51.2333,
        longitude: 2.9667,
        price: 42.00,
        capacity: 60,
        amenities: ['WiFi', 'Near Beach', 'Quiet Location', 'Cycling Routes', 'Pet Friendly'],
        images: ['https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800'],
        isActive: true,
        ownerId: ownerUser2.id
      }
    });
  }

  let campingSpot5 = await prisma.campingSpot.findFirst({
    where: { 
      title: 'Luxury Eco-Camping in High Fens Nature Reserve',
      location: 'Malmedy, Liège Province'
    }
  });
  
  if (!campingSpot5) {
    campingSpot5 = await prisma.campingSpot.create({
      data: {
        title: 'Luxury Eco-Camping in High Fens Nature Reserve',
        description: 'Premium eco-camping in the High Fens nature reserve. Glamping options available with stunning moorland views.',
        location: 'Malmedy, Liège Province',
        latitude: 50.4264,
        longitude: 6.0275,
        price: 55.00,
        capacity: 45,
        amenities: ['WiFi', 'Eco-Friendly', 'Glamping Options', 'Nature Reserve', 'Hiking', 'Wellness Center'],
        images: ['https://images.unsplash.com/photo-1496947850313-7743325fa58c?w=800'],
        isActive: true,
        ownerId: ownerUser1.id
      }
    });
  }

  let campingSpot6 = await prisma.campingSpot.findFirst({
    where: { 
      title: 'Historic Windmill Camping with Brewery Tours',
      location: 'Damme, West Flanders'
    }
  });
  
  if (!campingSpot6) {
    campingSpot6 = await prisma.campingSpot.create({
      data: {
        title: 'Historic Windmill Camping with Brewery Tours',
        description: 'Traditional Flemish camping next to a historic windmill. Experience authentic Belgian countryside with local brewery visits.',
        location: 'Damme, West Flanders',
        latitude: 51.2500,
        longitude: 3.2833,
        price: 32.00,
        capacity: 90,
        amenities: ['WiFi', 'Historic Windmill', 'Brewery Tours', 'Cycling Routes', 'Local Culture'],
        images: ['https://images.unsplash.com/photo-1533873204880-76bdf4d82a5d?w=800'],
        isActive: true,
        ownerId: ownerUser2.id
      }
    });
  }

  let campingSpot7 = await prisma.campingSpot.findFirst({
    where: { 
      title: 'Forest Retreat Near Brussels',
      location: 'Watermael-Boitsfort, Brussels'
    }
  });
  
  if (!campingSpot7) {
    campingSpot7 = await prisma.campingSpot.create({
      data: {
        title: 'Forest Retreat Near Brussels',
        description: 'Secluded forest camping in the Sonian Forest. Perfect for nature lovers wanting to escape the city while staying close to Brussels.',
        location: 'Watermael-Boitsfort, Brussels',
        latitude: 50.7833,
        longitude: 4.4167,
        price: 48.00,
        capacity: 75,
        amenities: ['WiFi', 'Forest Location', 'Near Brussels', 'Wildlife Watching', 'Quiet', 'Hiking Trails'],
        images: ['https://images.unsplash.com/photo-1508873881324-c92a3fc536ba?w=800'],
        isActive: true,
        ownerId: ownerUser1.id
      }
    });
  }
  console.log('✅ Camping spots created');

  // Create sample bookings (only if they don't exist)
  const existingBooking1 = await prisma.booking.findFirst({
    where: { 
      userId: regularUser1.id,
      spotId: campingSpot1.id 
    }
  });

  if (!existingBooking1) {
    await prisma.booking.create({
      data: {
        userId: regularUser1.id,
        spotId: campingSpot1.id,
        checkIn: new Date('2025-07-15'),
        checkOut: new Date('2025-07-20'),
        guests: 2,
        totalPrice: 225.00, // 5 nights * 45.00
        status: 'CONFIRMED',
        notes: 'Looking forward to our summer vacation!'
      }
    });
  }

  const existingBooking2 = await prisma.booking.findFirst({
    where: { 
      userId: regularUser2.id,
      spotId: campingSpot2.id 
    }
  });

  if (!existingBooking2) {
    await prisma.booking.create({
      data: {
        userId: regularUser2.id,
        spotId: campingSpot2.id,
        checkIn: new Date('2025-08-01'),
        checkOut: new Date('2025-08-05'),
        guests: 4,
        totalPrice: 140.00, // 4 nights * 35.00
        status: 'CONFIRMED',
        notes: 'Family camping trip in the Ardennes'
      }
    });
  }

  const existingBooking3 = await prisma.booking.findFirst({
    where: { 
      userId: regularUser3.id,
      spotId: campingSpot3.id 
    }
  });

  if (!existingBooking3) {
    await prisma.booking.create({
      data: {
        userId: regularUser3.id,
        spotId: campingSpot3.id,
        checkIn: new Date('2025-06-20'),
        checkOut: new Date('2025-06-25'),
        guests: 3,
        totalPrice: 192.50, // 5 nights * 38.50
        status: 'PENDING',
        notes: 'Weekend getaway by the lake'
      }
    });
  }
  console.log('✅ Sample bookings created');

  // Create sample reviews (only if they don't exist)
  const existingReview1 = await prisma.review.findFirst({
    where: { 
      userId: regularUser1.id,
      spotId: campingSpot1.id 
    }
  });

  if (!existingReview1) {
    await prisma.review.create({
      data: {
        userId: regularUser1.id,
        spotId: campingSpot1.id,
        rating: 5,
        comment: 'Amazing camping experience! The facilities were excellent and the staff was very friendly. Perfect location near the beach.',
        createdAt: new Date('2025-05-15')
      }
    });
  }

  const existingReview2 = await prisma.review.findFirst({
    where: { 
      userId: regularUser2.id,
      spotId: campingSpot2.id 
    }
  });

  if (!existingReview2) {
    await prisma.review.create({
      data: {
        userId: regularUser2.id,
        spotId: campingSpot2.id,
        rating: 4,
        comment: 'Great location in the Ardennes. Beautiful hiking trails and peaceful atmosphere. The campfire area was perfect for evening gatherings.',
        createdAt: new Date('2025-05-20')
      }
    });
  }
  console.log('✅ Sample reviews created');

  console.log('🎉 Database seeding completed successfully!');
  console.log('📊 Created:');
  console.log(`  - 1 Admin user`);
  console.log(`  - 2 Owner users`);
  console.log(`  - 5 Regular users`);
  console.log(`  - 7 Camping spots`);
  console.log(`  - 3 Sample bookings`);
  console.log(`  - 2 Sample reviews`);
  console.log('🔐 Login credentials:');
  console.log('  Admin: admin@campinghub.com / admin123');
  console.log('  Owner: john.owner@campinghub.com / password123');
  console.log('  User: user1@campinghub.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });