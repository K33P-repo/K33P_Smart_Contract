import fetch from 'node-fetch';

// Deployed API URL
const DEPLOYED_API_URL = 'https://k33p-backend-0kyx.onrender.com/api';

async function testDeployedZkLogin() {
  try {
    console.log('🧪 Testing Deployed ZK Login Endpoint with Updated Data');
    console.log('=' .repeat(60));
    console.log(`🌐 API URL: ${DEPLOYED_API_URL}`);
    console.log();
    
    // Use the updated ZK proof data provided by user
    const testData = {
      phone: "5631543289085",
      proof: {
        proof: "zk-proof-478ab76a305ad740475020c46295f428-bab6eb8648",
        publicInputs: {
          commitment: "bab6eb86483bde62ede2b7923375d6c2334a56842875fc3c68"
        },
        isValid: true
      },
      commitment: "bab6eb86483bde62ede2b7923375d6c2334a56842875fc3c68"
    };
    
    console.log('📋 Using Updated Test Data:');
    console.log(`   Phone: ${testData.phone}`);
    console.log(`   Commitment: ${testData.commitment}`);
    console.log(`   Proof: ${testData.proof.proof}`);
    console.log(`   Is Valid: ${testData.proof.isValid}`);
    console.log();
    
    // Test 1: Login with phone number
    console.log('🔐 Test 1: ZK Login with Phone Number');
    console.log('-'.repeat(50));
    
    const phoneLoginPayload = {
      phone: testData.phone,
      proof: testData.proof,
      commitment: testData.commitment
    };
    
    console.log('📤 Request Payload:');
    console.log(`   Phone: ${phoneLoginPayload.phone}`);
    console.log(`   Commitment: ${phoneLoginPayload.commitment}`);
    console.log(`   Proof: ${typeof phoneLoginPayload.proof} (${JSON.stringify(phoneLoginPayload.proof).length} chars)`);
    console.log();
    
    try {
      const phoneResponse = await fetch(`${DEPLOYED_API_URL}/zk/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(phoneLoginPayload)
      });
      
      const phoneResult = await phoneResponse.json();
      
      console.log(`📥 Response Status: ${phoneResponse.status}`);
      console.log('📥 Response Body:');
      console.log(JSON.stringify(phoneResult, null, 2));
      
      if (phoneResponse.ok && phoneResult.success) {
        console.log('✅ Phone Number Login: SUCCESS');
        if (phoneResult.data?.token) {
          console.log(`🎫 JWT Token received: ${phoneResult.data.token.substring(0, 50)}...`);
        }
      } else {
        console.log('❌ Phone Number Login: FAILED');
        console.log(`   Error: ${phoneResult.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('❌ Phone Number Login: ERROR');
      console.log(`   Error: ${error.message}`);
    }
    
    console.log();
    console.log('🏁 Test Complete');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Test Error:', error.message);
  }
}

testDeployedZkLogin();