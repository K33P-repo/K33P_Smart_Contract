import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';
const TEST_PHONE = '+123456789099';
const TEST_PIN = '123456';

async function testZKFlow() {
  console.log('🧪 Testing ZK Proof Flow\n');
  
  // Step 1: Generate commitment
  console.log('1. Generating commitment...');
  const commitmentResponse = await fetch(`${BASE_URL}/zk/commitment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: TEST_PHONE,
      biometric: 'static_biometric_data_base64_encoded',
      passkey: TEST_PIN
    })
  });
  
  const commitmentData = await commitmentResponse.json();
  console.log('Commitment Response:', commitmentData);
  
  if (!commitmentData.success) {
    console.log('❌ Failed to generate commitment');
    return;
  }
  
  const commitment = commitmentData.data.commitment;
  const cleanCommitment = commitment.replace(/-[^-]*$/, '');
  console.log(`Clean commitment: ${cleanCommitment}`);
  
  // Step 2: Generate proof with the commitment
  console.log('\n2. Generating proof...');
  const proofResponse = await fetch(`${BASE_URL}/zk/proof`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: TEST_PHONE,
      biometric: 'static_biometric_data_base64_encoded',
      passkey: TEST_PIN,
      commitment: cleanCommitment
    })
  });
  
  const proofData = await proofResponse.json();
  console.log('Proof Response:', proofData);
  
  if (proofData.success) {
    console.log('✅ ZK Proof flow completed successfully!');
  } else {
    console.log('❌ Proof generation failed');
  }
}

testZKFlow();
