import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';
const TEST_PHONE = '+123456789099';
const TEST_PIN = '123456';
const TEST_USER_ID = `test_user_${Date.now()}`;
const TEST_ADDRESS = 'addr_test1qpcgv0xqz5k0a8pucj2p5l5p0v5z5k0a8pucj2p5l5p0v5z5k0a8pucj2p5l5p0v5z5k0a8pucj2p5l5p0v5z5k0a8pu';

async function testSignup() {
  console.log('🚀 Testing User Signup Flow\n');
  
  // 1. Generate commitment
  console.log('1. Generating commitment...');
  const commitmentRes = await fetch(`${BASE_URL}/zk/commitment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: TEST_PHONE,
      biometric: 'static_biometric_data_base64_encoded',
      passkey: TEST_PIN
    })
  });
  
  const commitmentData = await commitmentRes.json();
  console.log('Commitment:', commitmentData.success ? '✅' : '❌');
  
  if (!commitmentData.success) return;
  
  const commitment = commitmentData.data.commitment.replace(/-[^-]*$/, '');
  
  // 2. User signup
  console.log('\n2. User signup...');
  const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: TEST_USER_ID,
      userAddress: TEST_ADDRESS,
      phoneNumber: TEST_PHONE,
      commitment: commitment
    })
  });
  
  const signupData = await signupRes.json();
  console.log('Signup Response:', signupData);
  
  // 3. Test refund
  console.log('\n3. Testing refund...');
  const refundRes = await fetch(`${BASE_URL}/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress: TEST_ADDRESS,
      walletAddress: TEST_ADDRESS
    })
  });
  
  const refundData = await refundRes.json();
  console.log('Refund Response:', refundData);
}

testSignup();
