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

// Generate random PIN
function generateRandomPIN() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function testSignupEndpoint() {
  console.log('🧪 Testing /api/auth/signup endpoint');
  console.log('=' .repeat(60));
  
  const walletAddress = generateRandomWalletAddress();
  const phoneNumber = generateRandomPhoneNumber();
  const pin = generateRandomPIN();
  
  console.log(`📋 Test Data:`);
  console.log(`   Wallet Address: ${walletAddress}`);
  console.log(`   Phone Number: ${phoneNumber}`);
  console.log(`   PIN: ${pin}`);
  console.log();
  
  const signupData = {
    walletAddress: walletAddress,
    phone: phoneNumber,
    biometric: 'mock_biometric_hash_' + Math.random().toString(36).substring(7),
    passkey: 'mock_passkey_data_' + Math.random().toString(36).substring(7)
  };
  
  try {
    console.log('📤 Sending signup request...');
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
      console.log('✅ Signup successful!');
      return { phoneNumber, pin, success: true, token: result.token };
    } else {
      console.log('❌ Signup failed');
      return { phoneNumber, pin, success: false, error: result };
    }
    
  } catch (error) {
    console.log('❌ Request failed:', error.message);
    return { phoneNumber, pin, success: false, error: error.message };
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

async function runTests() {
  console.log('🚀 Starting API Endpoint Tests');
  console.log(`🌐 Backend URL: ${API_BASE_URL}`);
  console.log();
  
  try {
    // Test 1: Signup
    const signupResult = await testSignupEndpoint();
    
    if (signupResult.success) {
      // Wait a moment for the signup to be processed
      console.log('\n⏳ Waiting 3 seconds before testing login...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Test 2: ZK Login with PIN
      const loginResult = await testZkLoginWithPinEndpoint(
        signupResult.phoneNumber, 
        signupResult.pin
      );
      
      console.log('\n📋 Test Summary:');
      console.log(`   Signup: ${signupResult.success ? '✅ Success' : '❌ Failed'}`);
      console.log(`   ZK Login: ${loginResult.success ? '✅ Success' : '❌ Failed'}`);
      
      if (signupResult.success && loginResult.success) {
        console.log('\n🎉 All tests passed! Both endpoints are working correctly.');
      } else {
        console.log('\n⚠️  Some tests failed. Check the error messages above.');
      }
    } else {
      console.log('\n❌ Signup failed, skipping login test.');
      console.log('📋 Test Summary:');
      console.log('   Signup: ❌ Failed');
      console.log('   ZK Login: ⏭️  Skipped (signup failed)');
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