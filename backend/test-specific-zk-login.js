import fetch from 'node-fetch';

const RENDER_API_BASE = 'https://k33p-backend-0kyx.onrender.com';

// Test ZK login with specific provided values
async function testSpecificZkLogin() {
  console.log('🎯 Testing ZK Login with Specific Values');
  console.log('=' .repeat(50));
  
  // Provided test values
  const testData = {
    commitment: "0c326aea2c005aa161c2335f6d74b108ab683af16f8256ba5c-9c102b9e",
    phone: "8546666886856",
    proof: "zk-proof-153e9a447c449ec971347cb29bf74415",
    walletAddress: "addr_test1wznyv36t3a2rzfs4q6mvyu7nqlr4dxjwkmykkskafg54yzs73573783773"
  };
  
  console.log('\n📋 Test Data:');
  console.log(`   Wallet Address: ${testData.walletAddress}`);
  console.log(`   Phone: ${testData.phone}`);
  console.log(`   Commitment: ${testData.commitment}`);
  console.log(`   Proof: ${testData.proof}`);
  
  try {
    // Test 1: ZK Login with wallet address
    console.log('\n🔐 Test 1: ZK Login with Wallet Address...');
    
    const walletLoginPayload = {
      walletAddress: testData.walletAddress,
      proof: {
        proof: testData.proof,
        publicInputs: {
          commitment: testData.commitment
        },
        isValid: true
      },
      commitment: testData.commitment
    };
    
    console.log('📤 Sending wallet login request...');
    const walletResponse = await fetch(`${RENDER_API_BASE}/api/zk/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(walletLoginPayload)
    });
    
    console.log(`📥 Response Status: ${walletResponse.status}`);
    const walletData = await walletResponse.json();
    console.log('📥 Response Data:', JSON.stringify(walletData, null, 2));
    
    if (walletResponse.status === 200) {
      console.log('✅ Wallet login successful!');
      if (walletData.token) {
        console.log(`🎫 JWT Token: ${walletData.token.substring(0, 50)}...`);
      }
    } else if (walletResponse.status === 404) {
      console.log('❌ User not found in deployed database');
    } else if (walletResponse.status === 401) {
      console.log('❌ Authentication failed - invalid proof or commitment');
    } else {
      console.log(`❌ Login failed with status: ${walletResponse.status}`);
    }
    
    // Test 2: ZK Login with phone
    console.log('\n🔐 Test 2: ZK Login with Phone...');
    
    const phoneLoginPayload = {
      phone: testData.phone,
      proof: {
        proof: testData.proof,
        publicInputs: {
          commitment: testData.commitment
        },
        isValid: true
      },
      commitment: testData.commitment
    };
    
    console.log('📤 Sending phone login request...');
    const phoneResponse = await fetch(`${RENDER_API_BASE}/api/zk/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(phoneLoginPayload)
    });
    
    console.log(`📥 Response Status: ${phoneResponse.status}`);
    const phoneData = await phoneResponse.json();
    console.log('📥 Response Data:', JSON.stringify(phoneData, null, 2));
    
    if (phoneResponse.status === 200) {
      console.log('✅ Phone login successful!');
      if (phoneData.token) {
        console.log(`🎫 JWT Token: ${phoneData.token.substring(0, 50)}...`);
      }
    } else if (phoneResponse.status === 404) {
      console.log('❌ User not found in deployed database');
    } else if (phoneResponse.status === 401) {
      console.log('❌ Authentication failed - invalid proof or commitment');
    } else {
      console.log(`❌ Login failed with status: ${phoneResponse.status}`);
    }
    
    // Test 3: Try with just the proof string (alternative format)
    console.log('\n🔐 Test 3: ZK Login with Simple Proof Format...');
    
    const simpleLoginPayload = {
      walletAddress: testData.walletAddress,
      proof: testData.proof,
      commitment: testData.commitment
    };
    
    console.log('📤 Sending simple format login request...');
    const simpleResponse = await fetch(`${RENDER_API_BASE}/api/zk/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(simpleLoginPayload)
    });
    
    console.log(`📥 Response Status: ${simpleResponse.status}`);
    const simpleData = await simpleResponse.json();
    console.log('📥 Response Data:', JSON.stringify(simpleData, null, 2));
    
    if (simpleResponse.status === 200) {
      console.log('✅ Simple format login successful!');
      if (simpleData.token) {
        console.log(`🎫 JWT Token: ${simpleData.token.substring(0, 50)}...`);
      }
    } else {
      console.log(`❌ Simple format login failed with status: ${simpleResponse.status}`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎯 Test Summary');
    console.log('\n📊 Results:');
    console.log(`   Wallet Login: ${walletResponse.status === 200 ? '✅ Success' : '❌ Failed (' + walletResponse.status + ')'}`);
    console.log(`   Phone Login: ${phoneResponse.status === 200 ? '✅ Success' : '❌ Failed (' + phoneResponse.status + ')'}`);
    console.log(`   Simple Format: ${simpleResponse.status === 200 ? '✅ Success' : '❌ Failed (' + simpleResponse.status + ')'}`);
    
    console.log('\n🔍 Analysis:');
    if (walletResponse.status === 200 || phoneResponse.status === 200 || simpleResponse.status === 200) {
      console.log('   ✅ ZK Login endpoint is working!');
      console.log('   ✅ Authentication successful with provided values');
      console.log('   ✅ User exists in deployed database');
    } else if (walletResponse.status === 404 || phoneResponse.status === 404) {
      console.log('   ❌ User not found in deployed database');
      console.log('   💡 The user may need to be created on the deployed API first');
    } else if (walletResponse.status === 401 || phoneResponse.status === 401) {
      console.log('   ❌ Authentication failed');
      console.log('   💡 The proof or commitment may be invalid or mismatched');
    } else {
      console.log('   ❌ Unexpected error occurred');
      console.log('   💡 Check API logs for more details');
    }
    
    console.log('\n🚀 Next Steps:');
    if (walletResponse.status === 404) {
      console.log('   1. Create a user with this wallet address on the deployed API');
      console.log('   2. Ensure the ZK commitment is stored correctly');
      console.log('   3. Retry the login test');
    } else if (walletResponse.status === 401) {
      console.log('   1. Verify the proof generation process');
      console.log('   2. Check commitment matching logic');
      console.log('   3. Ensure proof format is correct');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testSpecificZkLogin();