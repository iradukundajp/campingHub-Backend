const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing existing database...');

  // Clear all data in the correct order (respecting foreign key constraints)
  // Wrap in try-catch to handle cases where tables don't exist yet
  try {
    await prisma.review.deleteMany({});
    await prisma.booking.deleteMany({});
    await prisma.campingSpot.deleteMany({});
    await prisma.user.deleteMany({});
    console.log('✅ Existing data cleared successfully');
  } catch (error) {
    console.log('ℹ️ Database is fresh - no existing data to clear');
  }

  console.log('🌱 Starting fresh database seeding...');

  // Create Admin User
  const adminUser = await prisma.user.create({
    data: {
      firstName: 'Isabella',
      lastName: 'Rodriguez',
      email: 'admin@campinghub.be',
      password: await bcrypt.hash('admin123', 12),
      role: 'ADMIN',
      phone: '+32 2 555 0100',
      isVerified: true,
      isActive: true
    }
  });
  console.log('✅ Admin user created: admin@campinghub.be / admin123');

  // Create Owner Users
  const owner1 = await prisma.user.create({
    data: {
      firstName: 'Lucas',
      lastName: 'Van Der Berg',
      email: 'lucas.vanderberg@campinghub.be',
      password: await bcrypt.hash('owner123', 12),
      role: 'OWNER',
      phone: '+32 9 555 0200',
      isVerified: true,
      isActive: true
    }
  });

  const owner2 = await prisma.user.create({
    data: {
      firstName: 'Sophie',
      lastName: 'Laurent',
      email: 'sophie.laurent@campinghub.be',
      password: await bcrypt.hash('owner123', 12),
      role: 'OWNER',
      phone: '+32 4 555 0300',
      isVerified: true,
      isActive: true
    }
  });

  const owner3 = await prisma.user.create({
    data: {
      firstName: 'Matteo',
      lastName: 'Janssen',
      email: 'matteo.janssen@campinghub.be',
      password: await bcrypt.hash('owner123', 12),
      role: 'OWNER',
      phone: '+32 3 555 0400',
      isVerified: true,
      isActive: true
    }
  });

  const owner4 = await prisma.user.create({
    data: {
      firstName: 'Amélie',
      lastName: 'Dubois',
      email: 'amelie.dubois@campinghub.be',
      password: await bcrypt.hash('owner123', 12),
      role: 'OWNER',
      phone: '+32 11 555 0500',
      isVerified: true,
      isActive: true
    }
  });

  console.log('✅ 4 Owner users created');

  // Create Regular Users
  const user1 = await prisma.user.create({
    data: {
      firstName: 'Noah',
      lastName: 'Williams',
      email: 'noah.williams@gmail.com',
      password: await bcrypt.hash('user123', 12),
      role: 'USER',
      phone: '+32 2 555 0600',
      isVerified: true,
      isActive: true
    }
  });

  const user2 = await prisma.user.create({
    data: {
      firstName: 'Zara',
      lastName: 'Ahmed',
      email: 'zara.ahmed@hotmail.com',
      password: await bcrypt.hash('user123', 12),
      role: 'USER',
      phone: '+32 16 555 0700',
      isVerified: true,
      isActive: true
    }
  });

  const user3 = await prisma.user.create({
    data: {
      firstName: 'Elena',
      lastName: 'Petrov',
      email: 'elena.petrov@outlook.com',
      password: await bcrypt.hash('user123', 12),
      role: 'USER',
      phone: '+32 50 555 0800',
      isVerified: true,
      isActive: true
    }
  });

  console.log('✅ 3 Regular users created');

  // Create 12 Diverse Belgian Camping Spots
  const campingSpots = [
    {
      title: 'Coastal Dunes Luxury Resort',
      description: 'Premium beachfront glamping experience with panoramic North Sea views. Features luxury safari tents with private hot tubs, farm-to-table restaurant, and direct beach access through protected dunes.',
      location: 'De Panne, West Flanders',
      address: 'Zeelaan 42, 8660 De Panne',
      city: 'De Panne',
      state: 'West Flanders',
      country: 'Belgium',
      zipCode: '8660',
      latitude: 51.1033,
      longitude: 2.5939,
      price: 95.00,
      capacity: 80,
      amenities: ['WiFi', 'Beach Access', 'Hot Tubs', 'Restaurant', 'Spa', 'Luxury Tents', 'Concierge'],
      images: [
        'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop'
      ],
      rules: 'Adults-only resort. Minimum 2-night stay. Advance reservations required.',
      isInstantBook: false,
      ownerId: owner1.id
    },
    {
      title: 'Ardennes Wild Adventure Base',
      description: 'Rustic wilderness camping in the heart of the Belgian Ardennes. Perfect for thrill-seekers with rock climbing, whitewater rafting, mountain biking trails, and survival workshops.',
      location: 'Rochefort, Namur Province',
      address: 'Rue de la Grotte 78, 5580 Rochefort',
      city: 'Rochefort',
      state: 'Namur Province',
      country: 'Belgium',
      zipCode: '5580',
      latitude: 50.1626,
      longitude: 5.2221,
      price: 42.50,
      capacity: 100,
      amenities: ['WiFi', 'Rock Climbing', 'Rafting', 'Mountain Biking', 'Survival Workshops', 'Campfire Area'],
      images: [
        'https://images.unsplash.com/photo-1487730116645-74489c95b41b?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop'
      ],
      rules: 'Age minimum 16 for extreme activities. Safety briefing mandatory.',
      isInstantBook: true,
      ownerId: owner2.id
    },
    {
      title: 'Medieval Bruges Gateway',
      description: 'Charming family camping with authentic medieval atmosphere. Features reconstructed medieval village, traditional craft workshops, and daily shuttle to Bruges historic center.',
      location: 'Damme, West Flanders',
      address: 'Kerkstraat 156, 8340 Damme',
      city: 'Damme',
      state: 'West Flanders',
      country: 'Belgium',
      zipCode: '8340',
      latitude: 51.2500,
      longitude: 3.2833,
      price: 38.00,
      capacity: 90,
      amenities: ['WiFi', 'Medieval Village', 'Craft Workshops', 'Shuttle Service', 'Family Activities', 'Historic Tours'],
      images: [
        'https://images.unsplash.com/photo-1533873204880-76bdf4d82a5d?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&h=600&fit=crop'
      ],
      rules: 'Family-friendly environment. Medieval dress encouraged for workshops.',
      isInstantBook: true,
      ownerId: owner3.id
    },
    {
      title: 'High Fens Wilderness Retreat',
      description: 'Remote eco-camping in Belgium\'s highest nature reserve. Features sustainable cabins, aurora viewing tours, rare bog ecosystem walks, and digital detox programs.',
      location: 'Robertville, Liège Province',
      address: 'Route de Botrange 234, 4950 Robertville',
      city: 'Robertville',
      state: 'Liège Province',
      country: 'Belgium',
      zipCode: '4950',
      latitude: 50.4167,
      longitude: 6.1000,
      price: 55.00,
      capacity: 45,
      amenities: ['Eco Cabins', 'Aurora Tours', 'Nature Walks', 'Digital Detox', 'Observatory', 'Bog Ecosystem'],
      images: [
        'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&h=600&fit=crop'
      ],
      rules: 'No electronic devices in main areas. Guided tours mandatory for bog access.',
      isInstantBook: false,
      ownerId: owner4.id
    },
    {
      title: 'Brussels Urban Oasis',
      description: 'Modern urban camping in the heart of Europe\'s capital. Features rooftop gardens, EU institution tours, multicultural food markets, and easy metro access to all attractions.',
      location: 'Ixelles, Brussels',
      address: 'Avenue Louise 421, 1050 Ixelles',
      city: 'Ixelles',
      state: 'Brussels',
      country: 'Belgium',
      zipCode: '1050',
      latitude: 50.8333,
      longitude: 4.3667,
      price: 68.00,
      capacity: 75,
      amenities: ['WiFi', 'Rooftop Gardens', 'EU Tours', 'Food Markets', 'Metro Access', 'City Views'],
      images: [
        'https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&h=600&fit=crop'
      ],
      rules: 'Urban environment. Quiet hours strictly enforced.',
      isInstantBook: true,
      ownerId: owner1.id
    },
    {
      title: 'Trappist Monastery Farm Stay',
      description: 'Peaceful camping at an authentic Trappist monastery. Features beer brewing workshops, silent meditation retreats, organic farming experiences, and monastery chapel access.',
      location: 'Chimay, Hainaut Province',
      address: 'Route de Baileux 67, 6460 Chimay',
      city: 'Chimay',
      state: 'Hainaut Province',
      country: 'Belgium',
      zipCode: '6460',
      latitude: 50.0500,
      longitude: 4.3167,
      price: 44.00,
      capacity: 60,
      amenities: ['Beer Brewing', 'Meditation', 'Organic Farming', 'Chapel Access', 'Silent Areas', 'Traditional Meals'],
      images: [
        'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&h=600&fit=crop'
      ],
      rules: 'Respectful behavior required. Silent hours 20:00-08:00.',
      isInstantBook: false,
      ownerId: owner2.id
    },
    {
      title: 'Flanders Fields Memorial Camp',
      description: 'Historical camping dedicated to WWI remembrance. Features battlefield tours, museum access, poppy field walks, and last post ceremony attendance at Menin Gate.',
      location: 'Ypres, West Flanders',
      address: 'Ieperstraat 234, 8900 Ypres',
      city: 'Ypres',
      state: 'West Flanders',
      country: 'Belgium',
      zipCode: '8900',
      latitude: 50.8500,
      longitude: 2.8833,
      price: 36.00,
      capacity: 85,
      amenities: ['WiFi', 'Historical Tours', 'Museum Access', 'Memorial Sites', 'Educational Programs', 'Ceremony Access'],
      images: [
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop'
      ],
      rules: 'Respectful behavior at memorial sites. Educational tours recommended.',
      isInstantBook: true,
      ownerId: owner3.id
    },
    {
      title: 'Meuse River Adventure Hub',
      description: 'Active riverside camping with water sports focus. Features kayak expeditions, fishing competitions, riverboat dining, and cliff-top hiking trails along the dramatic Meuse valley.',
      location: 'Dinant, Namur Province',
      address: 'Quai de Meuse 89, 5500 Dinant',
      city: 'Dinant',
      state: 'Namur Province',
      country: 'Belgium',
      zipCode: '5500',
      latitude: 50.2612,
      longitude: 4.9134,
      price: 39.50,
      capacity: 95,
      amenities: ['WiFi', 'Kayak Expeditions', 'Fishing', 'Riverboat Dining', 'Cliff Hiking', 'Water Sports'],
      images: [
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1502780402662-acc01917936e?w=800&h=600&fit=crop'
      ],
      rules: 'Water safety certification required for expeditions. Fishing licenses available.',
      isInstantBook: true,
      ownerId: owner4.id
    },
    {
      title: 'Kempen Heathland Safari',
      description: 'Unique heathland camping with wildlife safari experiences. Features rare purple heath blooms, wild horse watching, photography workshops, and astronomy sessions under dark skies.',
      location: 'Lommel, Limburg',
      address: 'Heidestrand 123, 3920 Lommel',
      city: 'Lommel',
      state: 'Limburg',
      country: 'Belgium',
      zipCode: '3920',
      latitude: 51.2294,
      longitude: 5.3142,
      price: 33.00,
      capacity: 50,
      amenities: ['WiFi', 'Wildlife Safari', 'Photography Workshops', 'Astronomy', 'Heathland Tours', 'Dark Skies'],
      images: [
        'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop'
      ],
      rules: 'Wildlife protection guidelines strict. Photography ethics workshop required.',
      isInstantBook: false,
      ownerId: owner1.id
    },
    {
      title: 'Diamond District Urban Glamping',
      description: 'Luxury urban glamping in Antwerp\'s diamond quarter. Features gemstone workshops, fashion district tours, rooftop diamond cutting demonstrations, and Michelin-starred dining.',
      location: 'Antwerp, Antwerp Province',
      address: 'Diamantstraat 45, 2018 Antwerp',
      city: 'Antwerp',
      state: 'Antwerp Province',
      country: 'Belgium',
      zipCode: '2018',
      latitude: 51.2194,
      longitude: 4.4025,
      price: 78.00,
      capacity: 35,
      amenities: ['WiFi', 'Gemstone Workshops', 'Fashion Tours', 'Diamond Cutting', 'Luxury Tents', 'Fine Dining'],
      images: [
        'https://images.unsplash.com/photo-1496947850313-7743325fa58c?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=800&h=600&fit=crop'
      ],
      rules: 'Upscale environment. Dress code enforced for workshops.',
      isInstantBook: false,
      ownerId: owner2.id
    },
    {
      title: 'Comic Strip Adventure Park',
      description: 'Family-themed camping celebrating Belgian comic culture. Features Tintin treasure hunts, Smurf village recreation, comic creation workshops, and meetings with famous cartoon characters.',
      location: 'Brussels, Brussels',
      address: 'Rue des Sablons 67, 1000 Brussels',
      city: 'Brussels',
      state: 'Brussels',
      country: 'Belgium',
      zipCode: '1000',
      latitude: 50.8467,
      longitude: 4.3594,
      price: 49.00,
      capacity: 110,
      amenities: ['WiFi', 'Treasure Hunts', 'Character Meetings', 'Comic Workshops', 'Themed Areas', 'Family Fun'],
      images: [
        'https://images.unsplash.com/photo-1533873204880-76bdf4d82a5d?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&h=600&fit=crop'
      ],
      rules: 'Family-oriented. Comic character interactions scheduled.',
      isInstantBook: true,
      ownerId: owner3.id
    },
    {
      title: 'Spa Thermal Wellness Retreat',
      description: 'Luxurious wellness camping in the famous Spa region. Features natural thermal springs, professional spa treatments, meditation gardens, and healthy cuisine workshops.',
      location: 'Spa, Liège Province',
      address: 'Avenue des Thermes 234, 4900 Spa',
      city: 'Spa',
      state: 'Liège Province',
      country: 'Belgium',
      zipCode: '4900',
      latitude: 50.4833,
      longitude: 5.8667,
      price: 72.00,
      capacity: 65,
      amenities: ['Thermal Springs', 'Spa Treatments', 'Meditation Gardens', 'Wellness Programs', 'Healthy Cuisine', 'Relaxation'],
      images: [
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=600&fit=crop'
      ],
      rules: 'Wellness-focused environment. Quiet zones enforced.',
      isInstantBook: false,
      ownerId: owner4.id
    }
  ];

  console.log('🏕️ Creating 12 diverse Belgian camping spots...');
  
  const createdSpots = [];
  for (const spotData of campingSpots) {
    const spot = await prisma.campingSpot.create({
      data: spotData
    });
    createdSpots.push(spot);
  }
  console.log('✅ 12 Camping spots created');

  // Create diverse sample bookings
  console.log('📅 Creating sample bookings...');
  
  const sampleBookings = [
    {
      userId: user1.id,
      spotId: createdSpots[0].id, // Coastal Dunes Luxury Resort
      checkIn: new Date('2025-07-20'),
      checkOut: new Date('2025-07-23'),
      guests: 2,
      totalPrice: 285.00, // 3 nights * 95.00
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      notes: 'Anniversary celebration - requesting private hot tub'
    },
    {
      userId: user2.id,
      spotId: createdSpots[1].id, // Ardennes Wild Adventure Base
      checkIn: new Date('2025-08-15'),
      checkOut: new Date('2025-08-18'),
      guests: 4,
      totalPrice: 127.50, // 3 nights * 42.50
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      notes: 'Group adventure trip - interested in rock climbing and rafting'
    },
    {
      userId: user3.id,
      spotId: createdSpots[2].id, // Medieval Bruges Gateway
      checkIn: new Date('2025-09-10'),
      checkOut: new Date('2025-09-14'),
      guests: 3,
      totalPrice: 152.00, // 4 nights * 38.00
      status: 'PENDING',
      paymentStatus: 'PENDING',
      notes: 'Family trip with children - excited about medieval workshops'
    },
    {
      userId: user1.id,
      spotId: createdSpots[4].id, // Brussels Urban Oasis
      checkIn: new Date('2025-06-25'),
      checkOut: new Date('2025-06-27'),
      guests: 1,
      totalPrice: 136.00, // 2 nights * 68.00
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      notes: 'Business trip - need EU institution tour info'
    },
    {
      userId: user2.id,
      spotId: createdSpots[7].id, // Meuse River Adventure Hub
      checkIn: new Date('2025-10-05'),
      checkOut: new Date('2025-10-08'),
      guests: 2,
      totalPrice: 118.50, // 3 nights * 39.50
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      notes: 'Kayaking enthusiasts - looking forward to river expeditions'
    },
    {
      userId: user3.id,
      spotId: createdSpots[10].id, // Comic Strip Adventure Park
      checkIn: new Date('2025-08-01'),
      checkOut: new Date('2025-08-05'),
      guests: 5,
      totalPrice: 196.00, // 4 nights * 49.00
      status: 'PENDING',
      paymentStatus: 'PENDING',
      notes: 'Family vacation with kids - they love Tintin and Smurfs!'
    }
  ];

  for (const bookingData of sampleBookings) {
    await prisma.booking.create({
      data: bookingData
    });
  }
  console.log('✅ Sample bookings created');

  // Create authentic reviews
  console.log('⭐ Creating sample reviews...');
  
  const sampleReviews = [
    {
      userId: user1.id,
      spotId: createdSpots[4].id, // Brussels Urban Oasis
      rating: 5,
      comment: 'Perfect urban camping experience! The rooftop gardens were stunning and the EU tour was incredibly informative. Metro access made exploring Brussels effortless. Highly recommend for business travelers.',
      isVerified: true
    },
    {
      userId: user2.id,
      spotId: createdSpots[1].id, // Ardennes Wild Adventure Base
      rating: 4,
      comment: 'Thrilling adventure base with amazing activities! Rock climbing was expertly guided and the whitewater rafting was exhilarating. Only minor issue was some equipment showing wear. Great for adrenaline junkies!',
      isVerified: true
    },
    {
      userId: user2.id,
      spotId: createdSpots[7].id, // Meuse River Adventure Hub
      rating: 5,
      comment: 'Outstanding riverside location with top-notch water sports. The kayak expedition through the Meuse valley was breathtaking. Riverboat dining was a unique touch. Perfect for nature lovers!',
      isVerified: true
    },
    {
      userId: user1.id,
      spotId: createdSpots[0].id, // Coastal Dunes Luxury Resort
      rating: 5,
      comment: 'Absolutely magical anniversary getaway! The luxury safari tents with private hot tubs were incredible. Beach access through the dunes felt exclusive. Worth every euro for special occasions.',
      isVerified: true
    }
  ];

  for (const reviewData of sampleReviews) {
    await prisma.review.create({
      data: reviewData
    });
  }
  console.log('✅ Sample reviews created');

  console.log('🎉 Fresh database seeding completed successfully!');
  console.log('');
  console.log('📊 DATABASE SUMMARY:');
  console.log('  👤 Users: 8 total');
  console.log('    - 1 Admin');
  console.log('    - 4 Owners'); 
  console.log('    - 3 Regular users');
  console.log('  🏕️ Camping Spots: 12 unique Belgian destinations');
  console.log('  📅 Bookings: 6 diverse sample bookings');
  console.log('  ⭐ Reviews: 4 authentic reviews');
  console.log('');
  console.log('🔐 LOGIN CREDENTIALS:');
  console.log('  🔑 Admin: admin@campinghub.be / admin123');
  console.log('  🏠 Owner 1: lucas.vanderberg@campinghub.be / owner123');
  console.log('  🏠 Owner 2: sophie.laurent@campinghub.be / owner123');
  console.log('  🏠 Owner 3: matteo.janssen@campinghub.be / owner123');
  console.log('  🏠 Owner 4: amelie.dubois@campinghub.be / owner123');
  console.log('  👤 User 1: noah.williams@gmail.com / user123');
  console.log('  👤 User 2: zara.ahmed@hotmail.com / user123');
  console.log('  👤 User 3: elena.petrov@outlook.com / user123');
  console.log('');
  console.log('🏕️ FEATURED CAMPING SPOTS:');
  console.log('  🏖️ Coastal Dunes Luxury Resort - De Panne (€95/night)');
  console.log('  🏔️ Ardennes Wild Adventure Base - Rochefort (€42.50/night)');
  console.log('  🏰 Medieval Bruges Gateway - Damme (€38/night)');
  console.log('  🌿 High Fens Wilderness Retreat - Robertville (€55/night)');
  console.log('  🏙️ Brussels Urban Oasis - Ixelles (€68/night)');
  console.log('  🍺 Trappist Monastery Farm Stay - Chimay (€44/night)');
  console.log('  🕊️ Flanders Fields Memorial Camp - Ypres (€36/night)');
  console.log('  🚣 Meuse River Adventure Hub - Dinant (€39.50/night)');
  console.log('  🦌 Kempen Heathland Safari - Lommel (€33/night)');
  console.log('  💎 Diamond District Urban Glamping - Antwerp (€78/night)');
  console.log('  📚 Comic Strip Adventure Park - Brussels (€49/night)');
  console.log('  🧘 Spa Thermal Wellness Retreat - Spa (€72/night)');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });