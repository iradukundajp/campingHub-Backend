// test-registration.js
// Run this with: node test-registration.js

const fetch = require('node-fetch'); // You might need: npm install node-fetch

async function testRegistration() {
  try {
    // Test User Registration
    console.log('🔥 Testing User Registration...\n');
    
    const userData = {
      email: 'testuser@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      role: 'USER'
    };

    const response = await fetch('http://localhost:3000/api/users/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Registration Successful!');
      console.log('User:', result.user);
      console.log('Token:', result.token);
      
      // Test Login with the same credentials
      console.log('\n🔐 Testing Login...\n');
      
      const loginResponse = await fetch('http://localhost:3000/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password
        })
      });

      const loginResult = await loginResponse.json();
      
      if (loginResponse.ok) {
        console.log('✅ Login Successful!');
        console.log('User:', loginResult.user);
        console.log('Token:', loginResult.token);
      } else {
        console.log('❌ Login Failed:', loginResult);
      }
      
    } else {
      console.log('❌ Registration Failed:', result);
    }

  } catch (error) {
    console.error('🚨 Error:', error.message);
    console.log('\n💡 Make sure your server is running: npm start');
  }
}

// Test Owner Registration
async function testOwnerRegistration() {
  try {
    console.log('\n👑 Testing Owner Registration...\n');
    
    const ownerData = {
      email: 'owner@example.com',
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Owner',
      role: 'OWNER'
    };

    const response = await fetch('http://localhost:3000/api/users/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ownerData)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Owner Registration Successful!');
      console.log('Owner:', result.user);
      console.log('Token:', result.token);
      return result.token; // Return token for further testing
    } else {
      console.log('❌ Owner Registration Failed:', result);
    }

  } catch (error) {
    console.error('🚨 Error:', error.message);
  }
}

// Test Creating a Camping Spot (Owner only)
async function testCreateSpot(ownerToken) {
  if (!ownerToken) return;
  
  try {
    console.log('\n🏕️ Testing Create Camping Spot...\n');
    
    const spotData = {
      title: 'Beautiful Forest Retreat',
      description: 'A peaceful camping spot surrounded by nature',
      location: 'Ardennes, Belgium',
      price: 35.50,
      capacity: 6,
      amenities: ['Fire pit', 'Hiking trails', 'Water access'],
      latitude: 50.4165,
      longitude: 4.8357
    };

    const response = await fetch('http://localhost:3000/api/owners/spots', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify(spotData)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Camping Spot Created Successfully!');
      console.log('Spot:', result.spot);
    } else {
      console.log('❌ Failed to Create Spot:', result);
    }

  } catch (error) {
    console.error('🚨 Error:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting CampingHub API Tests...\n');
  
  // Test 1: User Registration & Login
  await testRegistration();
  
  // Test 2: Owner Registration
  const ownerToken = await testOwnerRegistration();
  
  // Test 3: Create Camping Spot
  await testCreateSpot(ownerToken);
  
  console.log('\n🎯 All tests completed!');
}

runAllTests();