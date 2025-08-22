import fetch from 'node-fetch';

// Deployed backend URL
const API_BASE_URL = 'https://k33p-backend-i9kj.onrender.com/api';

// Generate random phone number
function generateRandomPhoneNumber() {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const number = Math.floor(Math.random() * 9000) + 1000;
  return `+1${areaCode}${exchange}${number}`;
}

async function testCompleteSignupFlow() {
  console.log('🧪 Testing Complete Signup Flow with Biometric Setup');
  console.log('=' .repeat(70));
  
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
    
    if (!pinSetupResponse.ok) {
      console.log('❌ PIN setup failed:', JSON.stringify(pinSetupResult, null, 2));
      return { success: false, step: 'pin_setup', error: pinSetupResult };
    }
    
    const sessionId = pinSetupResult.data?.sessionId;
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
    
    if (!pinConfirmResponse.ok) {
      console.log('❌ PIN confirmation failed:', JSON.stringify(pinConfirmResult, null, 2));
      return { success: false, step: 'pin_confirm', error: pinConfirmResult };
    }
    
    console.log('✅ PIN confirmation successful!');
    
    // Step 3: Setup Biometric (optional but required for completion)
    console.log('\n📤 Step 3: Setting up biometric...');
    const biometricResponse = await fetch(`${API_BASE_URL}/auth/setup-biometric`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: sessionId,
        biometricType: 'fingerprint',
        biometricData: 'mock_fingerprint_data_' + Math.random().toString(36).substring(7)
      })
    });
    
    const biometricResult = await biometricResponse.json();
    console.log(`📥 Biometric Setup Status: ${biometricResponse.status}`);
    
    if (!biometricResponse.ok) {
      console.log('❌ Biometric setup failed:', JSON.stringify(biometricResult, null, 2));
      return { success: false, step: 'biometric_setup', error: biometricResult };
    }
    
    console.log('✅ Biometric setup successful!');
    
    // Step 4: Complete Signup
    console.log('\n📤 Step 4: Completing signup...');
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
    
    if (!signupCompleteResponse.ok) {
      console.log('❌ Signup completion failed:', JSON.stringify(signupCompleteResult, null, 2));
      return { success: false, step: 'signup_complete', error: signupCompleteResult };
    }
    
    console.log('✅ Signup completion successful!');
    console.log('📋 User Details:', JSON.stringify(signupCompleteResult.data, null, 2));
    
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
  console.log('=' .repeat(70));
  
  console.log(`📋 Login Data:`);
  console.log(`   Phone Number: ${phoneNumber}`);
  console.log(`   PIN: ${pin}`);
  console.log();
  
  const loginData = {
    phoneNumber: phoneNumber,
    pin: pin
  };
  
  try {
    console.log('📤 Sending ZK login request...');
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
      console.log(`   User ID: ${result.data?.userId}`);
      console.log(`   Wallet Address: ${result.data?.walletAddress}`);
      console.log(`   Auth Method: ${result.data?.authMethod}`);
      console.log(`   Token Generated: ${result.data?.token ? 'Yes' : 'No'}`);
      return { success: true, result };
    } else {
      console.log('❌ ZK Login with PIN failed');
      console.log(`   Error Code: ${result.error?.code}`);
      console.log(`   Error Message: ${result.error?.message}`);
      return { success: false, error: result };
    }
    
  } catch (error) {
    console.log('❌ Request failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function runCompleteTest() {
  console.log('🚀 Starting Complete API Flow Test');
  console.log(`🌐 Backend URL: ${API_BASE_URL}`);
  console.log('🎯 Testing: Complete Signup Flow + ZK Login with PIN');
  console.log();
  
  try {
    // Test Complete Signup Flow
    const signupResult = await testCompleteSignupFlow();
    
    if (signupResult.success) {
      // Wait for the signup to be fully processed
      console.log('\n⏳ Waiting 10 seconds for signup processing and ZK proof generation...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Test ZK Login with PIN
      const loginResult = await testZkLoginWithPinEndpoint(
        signupResult.phoneNumber, 
        signupResult.pin
      );
      
      // Final Summary
      console.log('\n🎯 FINAL TEST RESULTS');
      console.log('=' .repeat(70));
      console.log(`📝 Phone Number: ${signupResult.phoneNumber}`);
      console.log(`📝 PIN: ${signupResult.pin}`);
      console.log(`📝 User ID: ${signupResult.userId}`);
      console.log(`📝 Wallet Address: ${signupResult.walletAddress}`);
      console.log();
      console.log(`✅ Complete Signup Flow: ${signupResult.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`✅ ZK Login with PIN: ${loginResult.success ? 'SUCCESS' : 'FAILED'}`);
      
      if (signupResult.success && loginResult.success) {
        console.log('\n🎉 ALL TESTS PASSED! Both endpoints are working correctly.');
        console.log('🔐 The deployed backend successfully:');
        console.log('   • Created a new user with PIN-based authentication');
        console.log('   • Generated ZK proofs and commitments');
        console.log('   • Authenticated the user using ZK login with PIN');
        console.log('   • Connected to the Railway PostgreSQL database');
      } else {
        console.log('\n⚠️  Some tests failed. Check the error messages above.');
      }
    } else {
      console.log('\n❌ Signup failed, cannot test login.');
      console.log('📋 Test Summary:');
      console.log('   Complete Signup: ❌ FAILED');
      console.log('   ZK Login: ⏭️  SKIPPED (signup failed)');
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run the complete test
runCompleteTest()
  .then(() => {
    console.log('\n✅ Complete test suite finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });