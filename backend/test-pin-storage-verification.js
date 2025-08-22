// Test script to verify PIN storage during signup process
import pool from './dist/database/config.js';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

/**
 * Hash a phone number using the same method as the backend
 * @param {string} phone - Phone number to hash
 * @returns {string} - Hashed phone number
 */
function hashPhone(phone) {
  const salt = process.env.PHONE_HASH_SALT || 'default-salt';
  return crypto.createHash('sha256')
    .update(phone + salt)
    .digest('hex');
}

/**
 * Test the new signup flow with PIN setup
 * @param {Object} testData - Test user data
 * @returns {Promise<Object>} - Test results
 */
async function testNewSignupFlow(testData) {
  try {
    console.log('\n=== Testing New Signup Flow with PIN ===');
    
    // Step 1: Setup PIN
    console.log('\n📌 Step 1: Setting up PIN...');
    const setupPinResponse = await fetch(`${SERVER_URL}/api/auth/setup-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phoneNumber: testData.phoneNumber,
        pin: testData.pin
      })
    });
    
    const setupPinResult = await setupPinResponse.json();
    console.log('Setup PIN Response:', JSON.stringify(setupPinResult, null, 2));
    
    if (!setupPinResponse.ok) {
      return { success: false, step: 'setup-pin', error: setupPinResult };
    }
    
    const sessionId = setupPinResult.data?.sessionId;
    if (!sessionId) {
      return { success: false, step: 'setup-pin', error: 'No session ID returned' };
    }
    
    // Step 2: Confirm PIN
    console.log('\n✅ Step 2: Confirming PIN...');
    const confirmPinResponse = await fetch(`${SERVER_URL}/api/auth/confirm-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: sessionId,
        pin: testData.pin
      })
    });
    
    const confirmPinResult = await confirmPinResponse.json();
    console.log('Confirm PIN Response:', JSON.stringify(confirmPinResult, null, 2));
    
    if (!confirmPinResponse.ok) {
      return { success: false, step: 'confirm-pin', error: confirmPinResult };
    }
    
    // Step 3: Setup biometric (required before completing signup)
    console.log('\n🔐 Step 3: Setting up biometric...');
    const biometricSetupResponse = await fetch(`${SERVER_URL}/api/auth/setup-biometric`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: sessionId,
        biometricData: 'mock_biometric_data_for_testing'
      })
    });
    
    const biometricSetupResult = await biometricSetupResponse.json();
    console.log('Biometric Setup Response:', JSON.stringify(biometricSetupResult, null, 2));
    
    if (!biometricSetupResponse.ok) {
      return { success: false, step: 'biometric-setup', error: biometricSetupResult };
    }
    
    // Step 4: Complete signup
    console.log('\n🎯 Step 4: Completing signup...');
    const completeSignupResponse = await fetch(`${SERVER_URL}/api/auth/complete-signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: sessionId,
        userId: testData.userId,
        userAddress: testData.userAddress,
        username: testData.username || `user_${Date.now()}`
      })
    });
    
    const completeSignupResult = await completeSignupResponse.json();
    console.log('Complete Signup Response:', JSON.stringify(completeSignupResult, null, 2));
    
    if (!completeSignupResponse.ok) {
      return { success: false, step: 'complete-signup', error: completeSignupResult };
    }
    
    return { 
      success: true, 
      sessionId: sessionId,
      userId: testData.userId,
      phoneNumber: testData.phoneNumber,
      pin: testData.pin,
      userAddress: testData.userAddress
    };
    
  } catch (error) {
    console.error('Signup flow error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Check if PIN is stored in the database
 * @param {string} phoneNumber - Phone number to check
 * @param {string} expectedPin - Expected PIN value
 * @returns {Promise<Object>} - Database check results
 */
async function checkPinInDatabase(phoneNumber, expectedPin) {
  let client;
  try {
    console.log('\n=== Checking PIN Storage in Database ===');
    
    client = await pool.connect();
    
    // Hash the phone number to find the user
    const phoneHash = hashPhone(phoneNumber);
    console.log('Phone Hash:', phoneHash);
    
    // Query the database for the user
    const query = `
      SELECT 
        u.user_id,
        u.phone_hash,
        u.pin,
        u.pin_hash,
        u.created_at
      FROM users u
      WHERE u.phone_hash = $1
    `;
    
    const result = await client.query(query, [phoneHash]);
    
    if (result.rows.length === 0) {
      return { 
        success: false, 
        error: 'User not found in database',
        phoneHash: phoneHash
      };
    }
    
    const user = result.rows[0];
    console.log('User found in database:', JSON.stringify(user, null, 2));
    
    // Check if PIN is stored (could be in pin or pin_hash field)
     const pinStored = (user.pin !== null && user.pin !== undefined) || (user.pin_hash !== null && user.pin_hash !== undefined);
     const pinMatches = user.pin === expectedPin; // Direct comparison for plain text PIN
     
     console.log('\n📊 PIN Storage Analysis:');
     console.log('- PIN stored in database:', pinStored);
     console.log('- Expected PIN:', expectedPin);
     console.log('- Stored PIN (plain):', user.pin);
     console.log('- Stored PIN hash:', user.pin_hash);
     console.log('- PIN matches expected:', pinMatches);
     console.log('- PIN hash length:', user.pin_hash ? user.pin_hash.length : 0);
    
 return {
       success: pinStored && pinMatches,
       user: user,
       pinStored: pinStored,
       pinMatches: pinMatches,
       pinHashExists: user.pin_hash !== null && user.pin_hash !== undefined,
       verificationMethod: 'pin' // Default since this is a PIN test
     };
    
  } catch (error) {
    console.error('Database check error:', error.message);
    return { success: false, error: error.message };
  } finally {
    if (client) client.release();
  }
}

/**
 * Main test function
 */
async function runPinStorageTest() {
  try {
    console.log('🧪 Starting PIN Storage Verification Test');
    console.log('Server URL:', SERVER_URL);
    
    // Generate test data
    const timestamp = Date.now();
    const testData = {
      phoneNumber: `+1555${timestamp.toString().slice(-7)}`,
      pin: '1234',
      userId: `test_user_${timestamp}`,
      userAddress: `addr_test1qz${crypto.randomBytes(28).toString('hex')}`,
      username: `testuser_${timestamp}`
    };
    
    console.log('\n📋 Test Data:');
    console.log('- Phone Number:', testData.phoneNumber);
    console.log('- PIN:', testData.pin);
    console.log('- User ID:', testData.userId);
    console.log('- User Address:', testData.userAddress);
    console.log('- Username:', testData.username);
    
    // Test the signup flow
    const signupResult = await testNewSignupFlow(testData);
    
    if (!signupResult.success) {
      console.log('\n❌ Signup failed:', signupResult.error);
      console.log('Cannot proceed with PIN storage verification.');
      return;
    }
    
    console.log('\n✅ Signup completed successfully!');
    
    // Wait a moment for database to be updated
    console.log('\n⏳ Waiting 2 seconds for database update...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check PIN storage in database
    const dbCheckResult = await checkPinInDatabase(testData.phoneNumber, testData.pin);
    
    if (!dbCheckResult.success) {
      console.log('\n❌ Database check failed:', dbCheckResult.error);
      return;
    }
    
    // Analyze results
    console.log('\n🎯 Test Results Summary:');
    console.log('='.repeat(50));
    
    if (dbCheckResult.success && dbCheckResult.pinStored && dbCheckResult.pinMatches) {
      console.log('✅ SUCCESS: PIN is properly stored and matches expected value');
      console.log('   Verification method:', dbCheckResult.verificationMethod);
      console.log('   PIN stored as:', dbCheckResult.user.pin ? 'plain text' : 'hash only');
      console.log('   PIN hash length:', dbCheckResult.user.pin_hash ? dbCheckResult.user.pin_hash.length : 0);
    } else {
      console.log('❌ ISSUE: PIN is not properly stored or does not match');
      console.log('   PIN stored:', dbCheckResult.pinStored);
      console.log('   PIN matches:', dbCheckResult.pinMatches);
    }
    
    console.log('\n📊 Additional Information:');
    console.log('- User ID:', dbCheckResult.user.user_id);
    console.log('- Created At:', dbCheckResult.user.created_at);
    console.log('- Phone Hash:', dbCheckResult.user.phone_hash);
    
  } catch (error) {
    console.error('\n💥 Test Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Close database connection
    await pool.end();
    console.log('\n🔚 Test completed. Database connection closed.');
  }
}

// Run the test
runPinStorageTest();