import fetch from 'node-fetch';
import pool from './backend/dist/database/config.js';

const API_BASE_URL = 'http://localhost:3000/api';

async function testPinStorage() {
  console.log('🧪 Testing PIN Storage in Database');
  console.log('=' .repeat(50));
  
  const testPhoneNumber = '+1234567890';
  const testPin = '1234';
  const sessionId = 'test_session_' + Date.now();
  
  try {
    // Step 1: Setup PIN
    console.log('\n📱 Step 1: Setting up PIN...');
    const setupPinResponse = await fetch(`${API_BASE_URL}/auth/setup-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phoneNumber: testPhoneNumber,
        pin: testPin,
        sessionId: sessionId
      })
    });
    
    const setupPinResult = await setupPinResponse.json();
    console.log('Setup PIN result:', setupPinResult);
    
    if (!setupPinResult.success) {
      console.log('❌ Failed to setup PIN');
      return;
    }
    
    // Step 2: Confirm PIN
    console.log('\n✅ Step 2: Confirming PIN...');
    const confirmPinResponse = await fetch(`${API_BASE_URL}/auth/confirm-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: sessionId,
        pin: testPin
      })
    });
    
    const confirmPinResult = await confirmPinResponse.json();
    console.log('Confirm PIN result:', confirmPinResult);
    
    if (!confirmPinResult.success) {
      console.log('❌ Failed to confirm PIN');
      return;
    }
    
    // Step 3: Setup biometric (required for complete signup)
    console.log('\n🔐 Step 3: Setting up biometric...');
    const setupBiometricResponse = await fetch(`${API_BASE_URL}/auth/setup-biometric`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: sessionId,
        biometricType: 'fingerprint',
        biometricData: 'test_fingerprint_data'
      })
    });
    
    const setupBiometricResult = await setupBiometricResponse.json();
    console.log('Setup biometric result:', setupBiometricResult);
    
    if (!setupBiometricResult.success) {
      console.log('❌ Failed to setup biometric');
      return;
    }
    
    // Step 4: Complete signup
    console.log('\n🎯 Step 4: Completing signup...');
    const completeSignupResponse = await fetch(`${API_BASE_URL}/auth/complete-signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: sessionId,
        userId: 'test_user_' + Date.now(),
        username: 'test_user_' + Date.now()
      })
    });
    
    const completeSignupResult = await completeSignupResponse.json();
    console.log('Complete signup result:', completeSignupResult);
    
    if (!completeSignupResult.success) {
      console.log('❌ Failed to complete signup');
      return;
    }
    
    // Step 5: Check database for PIN storage
    console.log('\n🔍 Step 5: Checking database for PIN storage...');
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT 
          user_id,
          phone_number,
          pin,
          pin_hash,
          wallet_address,
          created_at
        FROM users 
        WHERE phone_number = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const result = await client.query(query, [testPhoneNumber]);
      
      if (result.rows.length === 0) {
        console.log('❌ No user found in database with phone number:', testPhoneNumber);
        return;
      }
      
      const user = result.rows[0];
      console.log('\n📊 Database Results:');
      console.log('User ID:', user.user_id);
      console.log('Phone Number:', user.phone_number);
      console.log('PIN stored:', user.pin ? '✅ YES' : '❌ NO');
      console.log('PIN value:', user.pin || 'NULL');
      console.log('PIN Hash stored:', user.pin_hash ? '✅ YES' : '❌ NO');
      console.log('PIN Hash value:', user.pin_hash || 'NULL');
      console.log('Wallet Address:', user.wallet_address || 'NULL');
      console.log('Created At:', user.created_at);
      
      if (user.pin === testPin) {
        console.log('\n🎉 SUCCESS: PIN is correctly stored in the database!');
      } else {
        console.log('\n❌ ISSUE: PIN in database does not match expected value');
        console.log('Expected:', testPin);
        console.log('Actual:', user.pin);
      }
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Error during PIN storage test:', error);
  }
}

// Run the test
testPinStorage().catch(console.error);