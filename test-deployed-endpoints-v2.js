import fetch from 'node-fetch';

// Deployed backend URL
const API_BASE_URL = 'https://k33p-backend-i9kj.onrender.com/api';

// Generate random wallet address (Cardano format)
function generateRandomWalletAddress() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let address = 'addr1q';
  for (let i = 0; i < 56; i++) {
    address += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return address;
}

// Generate random phone number
function generateRandomPhoneNumber() {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const number = Math.floor(Math.random() * 9000) + 1000;
  return `+1${areaCode}${exchange}${number}`;
}

async function testNewSignupFlow() {
  console.log('🧪 Testing New Signup Flow with PIN Setup');
  console.log('=' .repeat(60));
  
  const phoneNumber = generateRandomPhoneNumber();
  const pin = '1234'; // Use a standard PIN
  
  console.log(`📋 Test Data:`);
  console.log(`   Phone Number: ${phoneNumber}`);
  console.log(`   PIN: ${pin}`);
  console.log();
  
  try {
    // Step 1: Setup PIN
    console.log('📤 Step 1: Setting up PIN...');
    const pinSetupResponse = await fetch(`${API_BASE_URL}/auth/setup-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phoneNumber: phoneNumber,
        pin: pin
      })
    });
    
    const pinSetupResult = await pinSetupResponse.json();
    console.log(`📥 PIN Setup Status: ${pinSetupResponse.status}`);
    console.log('📥 PIN Setup Response:', JSON.stringify(pinSetupResult, null, 2));
    
    if (!pinSetupResponse.ok) {
      console.log('❌ PIN setup failed');
      return { success: false, step: 'pin_setup', error: pinSetupResult };
    }
    
    const sessionId = pinSetupResult.data?.sessionId;
    if (!sessionId) {
      console.log('❌ No session ID returned from PIN setup');
      return { success: false, step: 'pin_setup', error: 'No session ID' };
    }
    
    console.log(`✅ PIN setup successful! Session ID: ${sessionId}`);
    
    // Step 2: Confirm PIN
    console.log('\n📤 Step 2: Confirming PIN...');
    const pinConfirmResponse = await fetch(`${API_BASE_URL}/auth/confirm-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: sessionId,
        pin: pin
      })
    });
    
    const pinConfirmResult = await pinConfirmResponse.json();
    console.log(`📥 PIN Confirm Status: ${pinConfirmResponse.status}`);
    console.log('📥 PIN Confirm Response:', JSON.stringify(pinConfirmResult, null, 2));
    
    if (!pinConfirmResponse.ok) {
      console.log('❌ PIN confirmation failed');
      return { success: false, step: 'pin_confirm', error: pinConfirmResult };
    }
    
    console.log('✅ PIN confirmation successful!');
    
    // Step 3: Complete Signup
    console.log('\n📤 Step 3: Completing signup...');
    const signupCompleteResponse = await fetch(`${API_BASE_URL}/auth/complete-signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: sessionId
      })
    });
    
    const signupCompleteResult = await signupCompleteResponse.json();
    console.log(`📥 Signup Complete Status: ${signupCompleteResponse.status}`);
    console.log('📥 Signup Complete Response:', JSON.stringify(signupCompleteResult, null, 2));
    
    if (!signupCompleteResponse.ok) {
      console.log('❌ Signup completion failed');
      return { success: false, step: 'signup_complete', error: signupCompleteResult };
    }
    
    console.log('✅ Signup completion successful!');
    
    return {
      success: true,
      phoneNumber: phoneNumber,
      pin: pin,
      userId: signupCompleteResult.data?.userId,
      walletAddress: signupCompleteResult.data?.walletAddress
    };
    
  } catch (error) {
    console.log('❌ Request failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testZkLoginWithPinEndpoint(phoneNumber, pin) {
  console.log('\n🧪 Testing /api/zk/login-with-pin endpoint');
  console.log('=' .repeat(60));
  
  console.log(`📋 Login Data:`);
  console.log(`   Phone Number: ${phoneNumber}`);
  console.log(`   PIN: ${pin}`);
  console.log();
  
  const loginData = {
    phoneNumber: phoneNumber,
    pin: pin
  };
  
  try {
    console.log('📤 Sending login request...');
    const response = await fetch(`${API_BASE_URL}/zk/login-with-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginData)
    });
    
    const result = await response.json();
    
    console.log(`📥 Response Status: ${response.status}`);
    console.log('📥 Response Body:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ ZK Login with PIN successful!');
      return { success: true, result };
    } else {
      console.log('❌ ZK Login with PIN failed');
      return { success: false, error: result };
    }
    
  } catch (error) {
    console.log('❌ Request failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testLegacySignupEndpoint() {
  console.log('\n🧪 Testing Legacy /api/auth/signup endpoint');
  console.log('=' .repeat(60));
  
  const walletAddress = generateRandomWalletAddress();
  const phoneNumber = generateRandomPhoneNumber();
  
  console.log(`📋 Test Data:`);
  console.log(`   Wallet Address: ${walletAddress}`);
  console.log(`   Phone Number: ${phoneNumber}`);
  console.log();
  
  const signupData = {
    walletAddress: walletAddress,
    phone: phoneNumber,
    biometric: 'mock_biometric_hash_' + Math.random().toString(36).substring(7),
    passkey: 'mock_passkey_data_' + Math.random().toString(36).substring(7)
  };
  
  try {
    console.log('📤 Sending legacy signup request...');
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(signupData)
    });
    
    const result = await response.json();
    
    console.log(`📥 Response Status: ${response.status}`);
    console.log('📥 Response Body:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ Legacy signup successful!');
      return { phoneNumber, success: true, result };
    } else {
      console.log('❌ Legacy signup failed');
      return { phoneNumber, success: false, error: result };
    }
    
  } catch (error) {
    console.log('❌ Request failed:', error.message);
    return { phoneNumber, success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting Comprehensive API Endpoint Tests');
  console.log(`🌐 Backend URL: ${API_BASE_URL}`);
  console.log();
  
  try {
    // Test 1: New Signup Flow
    console.log('=== TEST 1: NEW SIGNUP FLOW ===');
    const newSignupResult = await testNewSignupFlow();
    
    if (newSignupResult.success) {
      // Wait a moment for the signup to be processed
      console.log('\n⏳ Waiting 5 seconds before testing login...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Test ZK Login with PIN
      const loginResult = await testZkLoginWithPinEndpoint(
        newSignupResult.phoneNumber, 
        newSignupResult.pin
      );
      
      console.log('\n📋 New Flow Test Summary:');
      console.log(`   New Signup: ${newSignupResult.success ? '✅ Success' : '❌ Failed'}`);
      console.log(`   ZK Login: ${loginResult.success ? '✅ Success' : '❌ Failed'}`);
    } else {
      console.log('\n❌ New signup flow failed, testing legacy signup...');
    }
    
    // Test 2: Legacy Signup Flow
    console.log('\n=== TEST 2: LEGACY SIGNUP FLOW ===');
    const legacySignupResult = await testLegacySignupEndpoint();
    
    console.log('\n📋 Legacy Flow Test Summary:');
    console.log(`   Legacy Signup: ${legacySignupResult.success ? '✅ Success' : '❌ Failed'}`);
    
    // Final Summary
    console.log('\n🎯 FINAL TEST SUMMARY:');
    console.log('=' .repeat(60));
    if (newSignupResult.success) {
      console.log('✅ New signup flow is working');
    } else {
      console.log('❌ New signup flow failed');
    }
    
    if (legacySignupResult.success) {
      console.log('✅ Legacy signup flow is working');
    } else {
      console.log('❌ Legacy signup flow failed');
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run the tests
runTests()
  .then(() => {
    console.log('\n✅ Test suite completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });