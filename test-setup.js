// test-setup.js
// Run this with: node test-setup.js

const http = require('http');

// Test function
function testEndpoint(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(responseData);
          resolve({
            status: res.statusCode,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: responseData
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Testing CampingHub Backend Setup...\n');

  try {
    // Test 1: API Health Check
    console.log('1. Testing API health check...');
    const healthCheck = await testEndpoint('/api/');
    console.log(`   Status: ${healthCheck.status}`);
    console.log(`   Response:`, healthCheck.data);
    
    if (healthCheck.status === 200) {
      console.log('   ✅ API is running!\n');
    } else {
      console.log('   ❌ API health check failed\n');
    }

    // Test 2: Database Connection
    console.log('2. Testing database connection...');
    const dbTest = await testEndpoint('/api/test-db');
    console.log(`   Status: ${dbTest.status}`);
    console.log(`   Response:`, dbTest.data);
    
    if (dbTest.status === 200) {
      console.log('   ✅ Database connection successful!\n');
    } else {
      console.log('   ❌ Database connection failed\n');
    }

    // Test 3: Registration
    console.log('3. Testing user registration...');
    const userData = {
      email: 'test@campinghub.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      role: 'USER'
    };

    const registration = await testEndpoint('/api/users/register', 'POST', userData);
    console.log(`   Status: ${registration.status}`);
    
    if (registration.status === 201) {
      console.log('   ✅ User registration successful!');
      console.log(`   User ID: ${registration.data.user.id}`);
      console.log(`   Token received: ${registration.data.token ? 'Yes' : 'No'}\n`);
    } else {
      console.log('   ⚠️  Registration response:', registration.data);
      console.log('   (This might fail if user already exists)\n');
    }

  } catch (error) {
    console.error('🚨 Test Error:', error.message);
    console.log('\n💡 Make sure your server is running with: npm start');
  }
}

runTests();