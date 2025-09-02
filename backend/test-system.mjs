#!/usr/bin/env node

// Simple test script to verify the backend system
import { initializeDatabase } from './lib/database.mjs';
import { UserModel } from './lib/user.mjs';
import { Logger } from './lib/logger.mjs';

console.log('🚀 Testing TripMaster AI Backend System...\n');

// Test 1: Database initialization
console.log('1. Testing database initialization...');
try {
  initializeDatabase();
  console.log('✅ Database initialized successfully');
} catch (error) {
  console.log('❌ Database initialization failed:', error.message);
}

// Test 2: User creation
console.log('\n2. Testing user creation...');
try {
  const testUser = await UserModel.createUser(
    'test@example.com',
    'password123',
    'Test User'
  );
  console.log('✅ User created successfully:', testUser.email);
} catch (error) {
  console.log('❌ User creation failed:', error.message);
}

// Test 3: User login
console.log('\n3. Testing user login...');
try {
  const user = await UserModel.findByEmail('test@example.com');
  if (user) {
    const isValid = await UserModel.verifyPassword(user, 'password123');
    if (isValid) {
      console.log('✅ User login successful');
    } else {
      console.log('❌ User login failed: invalid password');
    }
  } else {
    console.log('❌ User login failed: user not found');
  }
} catch (error) {
  console.log('❌ User login failed:', error.message);
}

// Test 4: Logging system
console.log('\n4. Testing logging system...');
try {
  await Logger.logSystemAction('test_action', { test: true });
  console.log('✅ Logging system working');
} catch (error) {
  console.log('❌ Logging system failed:', error.message);
}

console.log('\n🎉 Backend system test completed!');
console.log('\n📋 Next steps:');
console.log('1. Set up environment variables in .env');
console.log('2. Configure email service (Gmail app password)');
console.log('3. Start the server with: node server-new.mjs');
console.log('4. Test API endpoints with curl or Postman');