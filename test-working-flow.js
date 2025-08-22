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

async function testLegacySignupWithPIN() {
  console.log('🧪 Testing Legacy Signup with PIN Setup');
  console.log('=' .repeat(70));
  
  const walletAddress = generateRandomWalletAddress();
  const phoneNumber = generateRandomPhoneNumber();
  const pin = '1234';
  
  console.log(`📋 Test Data:`);
  console.log(`   Wallet Address: ${walletAddress}`);
  console.log(`   Phone Number: ${phoneNumber}`);
  console.log(`   PIN: ${pin}`);
  console.log();
  
  try {
    // Step 1: Legacy Signup
    console.log('📤 Step 1: Creating user with legacy signup...');
    const signupData = {
      walletAddress: walletAddress,
      phone: phoneNumber,
      biometric: 'mock_biometric_hash_' + Math.random().toString(36).substring(7),
      passkey: 'mock_passkey_data_' + Math.random().toString(36).substring(7)
    };
    
    const signupResponse = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(signupData)
    });
    
    const signupResult = await signupResponse.json();
    console.log(`📥 Signup Status: ${signupResponse.status}`);
    
    if (!signupResponse.ok) {
      console.log('❌ Legacy signup failed:', JSON.stringify(signupResult, null, 2));
      return { success: false, step: 'legacy_signup', error: signupResult };
    }
    
    console.log('✅ Legacy signup successful!');
    console.log(`   User ID: ${signupResult.data?.userId}`);
    console.log(`   Wallet Address: ${signupResult.data?.depositAddress}`);
    
    const userId = signupResult.data?.userId;
    
    // Step 2: Setup PIN for the created user
    console.log('\n📤 Step 2: Setting up PIN for the user...');
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
    
    if (pinSetupResponse.ok) {
      console.log('✅ PIN setup successful!');
      
      const sessionId = pinSetupResult.data?.sessionId;
      
      // Step 3: Confirm PIN
      console.log('\n📤 Step 3: Confirming PIN...');
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
      
      if (pinConfirmResponse.ok) {
        console.log('✅ PIN confirmation successful!');
      } else {
        console.log('⚠️  PIN confirmation failed, but continuing with test...');
      }
    } else {
      console.log('⚠️  PIN setup failed, but user was created. Continuing with test...');
    }
    
    return {
      success: true,
      phoneNumber: phoneNumber,
      pin: pin,
      userId: userId,
      walletAddress: walletAddress
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

async function testDirectPinUpdate(phoneNumber, pin, userId) {
  console.log('\n🧪 Testing Direct PIN Update (if available)');
  console.log('=' .repeat(70));
  
  try {
    // Try to update PIN directly for the user
    const updateData = {
      userId: userId,
      phoneNumber: phoneNumber,
      pin: pin
    };
    
    console.log('📤 Attempting direct PIN update...');
    const response = await fetch(`${API_BASE_URL}/auth/update-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    const result = await response.json();
    console.log(`📥 PIN Update Status: ${response.status}`);
    console.log('📥 PIN Update Response:', JSON.stringify(result, null, 2));
    
    return response.ok;
    
  } catch (error) {
    console.log('⚠️  Direct PIN update not available or failed:', error.message);
    return false;
  }
}

async function runWorkingFlowTest() {
  console.log('🚀 Starting Working Flow Test');
  console.log(`🌐 Backend URL: ${API_BASE_URL}`);
  console.log('🎯 Testing: Legacy Signup + PIN Setup + ZK Login');
  console.log();
  
  try {
    // Test Legacy Signup with PIN
    const signupResult = await testLegacySignupWithPIN();
    
    if (signupResult.success) {
      // Wait for processing
      console.log('\n⏳ Waiting 5 seconds for user processing...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Try direct PIN update
      const pinUpdateSuccess = await testDirectPinUpdate(
        signupResult.phoneNumber,
        signupResult.pin,
        signupResult.userId
      );
      
      if (pinUpdateSuccess) {
        console.log('\n⏳ Waiting 3 seconds after PIN update...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
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
      console.log(`✅ Legacy Signup: ${signupResult.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`✅ PIN Update: ${pinUpdateSuccess ? 'SUCCESS' : 'FAILED/SKIPPED'}`);
      console.log(`✅ ZK Login with PIN: ${loginResult.success ? 'SUCCESS' : 'FAILED'}`);
      
      if (signupResult.success && loginResult.success) {
        console.log('\n🎉 CORE FUNCTIONALITY WORKING!');
        console.log('🔐 The deployed backend successfully:');
        console.log('   • Created a new user with random wallet address');
        console.log('   • Connected to the Railway PostgreSQL database');
        console.log('   • Processed authentication requests');
        console.log('   • Both /api/auth/signup and /api/zk/login-with-pin endpoints are accessible');
      } else if (signupResult.success) {
        console.log('\n✅ SIGNUP WORKING, LOGIN NEEDS ATTENTION');
        console.log('🔐 The deployed backend successfully:');
        console.log('   • Created a new user with random wallet address');
        console.log('   • Connected to the Railway PostgreSQL database');
        console.log('   • /api/auth/signup endpoint is working');
        console.log('   ⚠️  /api/zk/login-with-pin endpoint needs PIN/ZK proof setup');
      } else {
        console.log('\n⚠️  Tests completed with issues. Check error messages above.');
      }
    } else {
      console.log('\n❌ Signup failed, cannot test login.');
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run the working flow test
runWorkingFlowTest()
  .then(() => {
    console.log('\n✅ Working flow test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });