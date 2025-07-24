// Complete test flow for K33P signup and refund with all hashed inputs
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const SERVER_URL = 'https://k33p-backend.onrender.com';

/**
 * Hash a string using SHA-256
 * @param {string} input - The input to hash
 * @param {string} salt - Optional salt
 * @returns {string} - The hash
 */
function hashInput(input, salt = '') {
  return crypto.createHash('sha256')
    .update(input + salt)
    .digest('hex');
}

/**
 * Generate a JWT token for testing
 * @param {string} userId - User ID
 * @param {string} userAddress - User wallet address
 * @returns {string} - JWT token
 */
function generateTestToken(userId, userAddress) {
  const payload = {
    userId: userId,
    userAddress: userAddress,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
  };
  
  return jwt.sign(payload, JWT_SECRET);
}

/**
 * Test the signup endpoint with complete user data
 * @param {Object} userData - Complete user data with hashes
 * @returns {Promise<Object>} - Response from signup endpoint
 */
async function testSignup(userData) {
  try {
    console.log('\n=== Testing Signup Endpoint ===');
    console.log('User Data:', JSON.stringify(userData, null, 2));
    
    const response = await fetch(`${SERVER_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });
    
    const result = await response.json();
    console.log('Signup Response Status:', response.status);
    console.log('Signup Response:', JSON.stringify(result, null, 2));
    
    return { success: response.ok, data: result, status: response.status };
  } catch (error) {
    console.error('Signup Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test the refund endpoint
 * @param {string} userAddress - User wallet address
 * @param {string} token - JWT token
 * @returns {Promise<Object>} - Response from refund endpoint
 */
async function testRefund(userAddress, token) {
  try {
    console.log('\n=== Testing Refund Endpoint ===');
    console.log('User Address:', userAddress);
    console.log('Token:', token.substring(0, 50) + '...');
    
    const refundData = {
      userAddress: userAddress
    };
    
    const response = await fetch(`${SERVER_URL}/api/utxo/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(refundData)
    });
    
    const result = await response.json();
    console.log('Refund Response Status:', response.status);
    console.log('Refund Response:', JSON.stringify(result, null, 2));
    
    return { success: response.ok, data: result, status: response.status };
  } catch (error) {
    console.error('Refund Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main test function
 */
async function runCompleteTest() {
  try {
    console.log('=== K33P Complete Flow Test ===');
    console.log('Server URL:', SERVER_URL);
    console.log('JWT Secret (first 20 chars):', JWT_SECRET.substring(0, 20) + '...');
    
    // Generate test user data
    const timestamp = Date.now();
    const testPhone = `+1234567${timestamp.toString().slice(-3)}`;
    const testBiometric = `biometric_data_${timestamp}`;
    const testPasskey = `passkey_${timestamp}`;
    const testPin = '123456';
    const testUserId = `user_${timestamp}`;
    const testUserAddress = 'addr_test1qz' + crypto.randomBytes(28).toString('hex');
    
    console.log('\n=== Generated Test Data ===');
    console.log('Phone:', testPhone);
    console.log('Biometric:', testBiometric);
    console.log('Passkey:', testPasskey);
    console.log('PIN:', testPin);
    console.log('User ID:', testUserId);
    console.log('User Address:', testUserAddress);
    
    // Generate hashes
    const phoneHash = hashInput(testPhone, process.env.PHONE_HASH_SALT || 'default-salt');
    const biometricHash = hashInput(testBiometric);
    const passkeyHash = hashInput(testPasskey);
    const pinHash = hashInput(testPin);
    
    console.log('\n=== Generated Hashes ===');
    console.log('Phone Hash:', phoneHash);
    console.log('Biometric Hash:', biometricHash);
    console.log('Passkey Hash:', passkeyHash);
    console.log('PIN Hash:', pinHash);
    
    // Prepare complete signup data
    const signupData = {
      userAddress: testUserAddress,
      userId: testUserId,
      phoneNumber: testPhone,
      pin: testPin,
      verificationMethod: 'phone',
      // Include all hashed inputs
      phoneHash: phoneHash,
      biometricHash: biometricHash,
      passkeyHash: passkeyHash,
      pinHash: pinHash,
      // Raw inputs for ZK proof generation
      phone: testPhone,
      biometric: testBiometric,
      passkey: testPasskey
    };
    
    // Test signup
    const signupResult = await testSignup(signupData);
    
    if (signupResult.success) {
      console.log('\n✅ Signup successful!');
      
      // Generate JWT token for refund test
      const token = generateTestToken(testUserId, testUserAddress);
      console.log('\nGenerated JWT Token for refund test');
      
      // Wait a moment before testing refund
      console.log('\nWaiting 2 seconds before testing refund...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test refund
      const refundResult = await testRefund(testUserAddress, token);
      
      if (refundResult.success) {
        console.log('\n✅ Refund successful!');
      } else {
        console.log('\n❌ Refund failed:', refundResult.error || refundResult.data?.message);
      }
    } else {
      console.log('\n❌ Signup failed:', signupResult.error || signupResult.data?.message);
      console.log('Cannot proceed with refund test without successful signup.');
    }
    
    console.log('\n=== Test Complete ===');
    
  } catch (error) {
    console.error('Test Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
runCompleteTest();