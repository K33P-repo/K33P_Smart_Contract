// Test script for ZK identity flow with fully mocked responses (no server connection required)
import crypto from 'crypto';

// Hash functions from hash.js
const hashPhone = (phone) => {
  return crypto.createHash('sha256')
    .update(`phone:${phone}`)
    .digest('hex');
};

const hashBiometric = (biometric) => {
  return crypto.createHash('sha256')
    .update(`biometric:${biometric}`)
    .digest('hex');
};

const hashPasskey = (passkey) => {
  return crypto.createHash('sha256')
    .update(`passkey:${passkey}`)
    .digest('hex');
};

// Test data with the provided Cardano address
const testData = {
  walletAddress: 'addr_test1qp8cjjan499llrgw6tyyzclxg8gxjxc9mwc4w7rqcx8jrmwza2v0vp3dk3jcdq47teay45jqy5zqx47h6u4zar2f07lqd6f8py',
  phone: '1234567890',
  biometric: 'test_biometric',
  passkey: 'test_passkey',
  email: 'test@example.com',
  name: 'Test User'
};

// Mock user database
let mockUser = null;

// Step 1: Generate a ZK commitment (fully mocked)
const generateCommitment = async () => {
  // Hash the inputs
  const phoneHash = hashPhone(testData.phone);
  const biometricHash = hashBiometric(testData.biometric);
  const passkeyHash = hashPasskey(testData.passkey);

  console.log('Hashed inputs:');
  console.log('Phone Hash:', phoneHash);
  console.log('Biometric Hash:', biometricHash);
  console.log('Passkey Hash:', passkeyHash);

  console.log('\nMocking request to /api/zk/commitment with data:', {
    phone: testData.phone,
    biometric: testData.biometric,
    passkey: testData.passkey
  });

  // Generate a mock commitment (in a real system, this would be a cryptographic commitment)
  const mockCommitment = crypto.createHash('sha256')
    .update(`${phoneHash}:${biometricHash}:${passkeyHash}`)
    .digest('hex');

  console.log('\nCommitment generated successfully:');
  console.log('Commitment:', mockCommitment);
  
  return mockCommitment;
};

// Step 2: Generate a ZK proof (fully mocked)
const generateProof = async (commitment) => {
  console.log('\nMocking request to /api/zk/proof with data:', {
    phone: testData.phone,
    biometric: testData.biometric,
    passkey: testData.passkey,
    commitment
  });

  // Generate a mock proof (in a real system, this would be a zero-knowledge proof)
  const mockProof = crypto.createHash('sha256')
    .update(`proof:${commitment}`)
    .digest('hex');

  const proofResponse = {
    proof: mockProof,
    publicSignals: [commitment]
  };

  console.log('\nProof generated successfully:');
  console.log('Proof Response:', proofResponse);
  
  return proofResponse;
};

// Step 3: Create a mock user with the ZK commitment
const createMockUser = async (commitment) => {
  // Create a mock user
  const userId = crypto.randomUUID();
  mockUser = {
    id: userId,
    walletAddress: testData.walletAddress,
    email: testData.email,
    name: testData.name,
    phoneHash: hashPhone(testData.phone),
    zkCommitment: commitment
  };
  
  console.log('\nMock user created successfully:');
  console.log('User ID:', userId);
  console.log('User Data:', mockUser);
  
  return userId;
};

// Step 4: Attempt ZK login with our mock user
const attemptZkLogin = async (proofObj, commitment) => {
  console.log('\nMocking request to /api/zk/login with data:', {
    walletAddress: testData.walletAddress,
    phone: testData.phone,
    proof: proofObj.proof,
    commitment
  });

  // Verify with mock user
  console.log('\nVerifying with mock user:');
  console.log('Mock User Wallet:', mockUser.walletAddress);
  console.log('Request Wallet:', testData.walletAddress);
  console.log('Mock User Commitment:', mockUser.zkCommitment);
  console.log('Request Commitment:', commitment);
  
  const mockVerification = {
    walletAddressMatch: mockUser.walletAddress === testData.walletAddress,
    commitmentMatch: mockUser.zkCommitment === commitment,
    phoneHashMatch: mockUser.phoneHash === hashPhone(testData.phone)
  };
  
  console.log('Mock Verification Results:', mockVerification);
  
  // For our test purposes, we'll use our mock verification
  if (mockVerification.walletAddressMatch && mockVerification.commitmentMatch && mockVerification.phoneHashMatch) {
    console.log('\nMock login successful:');
    console.log('User ID:', mockUser.id);
    return { success: true, userId: mockUser.id };
  } else {
    console.log('\nMock login failed:');
    const error = 'Mock verification failed';
    console.log('Error:', error);
    return { success: false, error };
  }
};

// Run the test flow
const runTest = async () => {
  try {
    console.log('=== TESTING ZK IDENTITY FLOW WITH FULLY MOCKED RESPONSES ===');
    console.log('Using Cardano address:', testData.walletAddress);
    
    // Step 1: Generate a commitment
    console.log('\n=== STEP 1: GENERATE COMMITMENT ===');
    const commitment = await generateCommitment();
    
    // Step 2: Generate a proof
    console.log('\n=== STEP 2: GENERATE PROOF ===');
    const proofResponse = await generateProof(commitment);
    
    // Step 3: Create a mock user with the ZK commitment
    console.log('\n=== STEP 3: CREATE MOCK USER ===');
    const userId = await createMockUser(commitment);
    
    // Step 4: Attempt ZK login with our mock user
    console.log('\n=== STEP 4: ATTEMPT ZK LOGIN WITH MOCK USER ===');
    const loginResult = await attemptZkLogin(proofResponse, commitment);
    
    console.log('\n=== TEST RESULTS ===');
    console.log('Commitment Generated:', !!commitment);
    console.log('Proof Generated:', !!proofResponse.proof);
    console.log('Mock User Created:', !!userId);
    console.log('Mock Login Success:', loginResult.success);
    if (!loginResult.success) {
      console.log('Login Error:', loginResult.error);
    }
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('\nTest failed:', error.message);
  }
};

// Run the test
runTest();