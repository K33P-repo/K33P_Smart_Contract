// Test script for ZK identity route (create user and login)
import crypto from 'crypto';
import http from 'http';

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

// Test data
const testData = {
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  phone: '1234567890',
  biometric: 'test_biometric',
  passkey: 'test_passkey',
  email: 'test@example.com',
  name: 'Test User'
};

// Helper function for HTTP requests
const makeRequest = (options, data = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`Status Code: ${res.statusCode}`);
      
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log('Response:', responseData);
        
        try {
          // Check if response is empty
          if (!responseData || responseData.trim() === '') {
            resolve({ statusCode: res.statusCode, data: null });
            return;
          }
          
          const parsedResponse = JSON.parse(responseData);
          resolve({ statusCode: res.statusCode, data: parsedResponse });
        } catch (error) {
          console.error('Error parsing response:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error making request:', error.message);
      reject(error);
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
};

// Step 1: Generate a ZK commitment
const generateCommitment = async () => {
  // Hash the inputs
  const phoneHash = hashPhone(testData.phone);
  const biometricHash = hashBiometric(testData.biometric);
  const passkeyHash = hashPasskey(testData.passkey);

  console.log('Hashed inputs:');
  console.log('Phone Hash:', phoneHash);
  console.log('Biometric Hash:', biometricHash);
  console.log('Passkey Hash:', passkeyHash);

  // Make a request to the ZK commitment endpoint
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/zk/commitment',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const data = JSON.stringify({
    phone: testData.phone,
    biometric: testData.biometric,
    passkey: testData.passkey
  });

  console.log('\nSending request to /api/zk/commitment with data:', data);

  const response = await makeRequest(options, data);
  
  if (response.statusCode === 200 && response.data.commitment) {
    console.log('\nCommitment generated successfully:');
    console.log('Commitment:', response.data.commitment);
    return response.data.commitment;
  } else {
    throw new Error('Failed to generate commitment');
  }
};

// Step 2: Generate a ZK proof
const generateProof = async (commitment) => {
  // Make a request to the ZK proof endpoint
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/zk/proof',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const data = JSON.stringify({
    phone: testData.phone,
    biometric: testData.biometric,
    passkey: testData.passkey,
    commitment
  });

  console.log('\nSending request to /api/zk/proof with data:', data);

  const response = await makeRequest(options, data);
  
  if (response.statusCode === 200 && response.data.proof) {
    console.log('\nProof generated successfully:');
    console.log('Proof Response:', response.data);
    return response.data;
  } else {
    throw new Error('Failed to generate proof');
  }
};

// Step 3: Create a user with the ZK commitment
const createUser = async (commitment) => {
  // Make a request to the signup endpoint
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/signup',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const data = JSON.stringify({
    walletAddress: testData.walletAddress,
    email: testData.email,
    name: testData.name,
    phoneHash: hashPhone(testData.phone),
    zkCommitment: commitment
  });

  console.log('\nSending request to /api/auth/signup with data:', data);

  const response = await makeRequest(options, data);
  
  if (response.statusCode === 201 && response.data.userId) {
    console.log('\nUser created successfully:');
    console.log('User ID:', response.data.userId);
    return response.data.userId;
  } else {
    console.log('Failed to create user:', response.data?.error || 'Unknown error');
    throw new Error('Failed to create user');
  }
};

// Step 4: Attempt ZK login
const attemptZkLogin = async (proofObj, commitment) => {
  // Make a request to the ZK login endpoint
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/zk/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const data = JSON.stringify({
    walletAddress: testData.walletAddress,
    phone: testData.phone,
    proof: proofObj.proof,
    commitment
  });

  console.log('\nSending request to /api/zk/login with data:', data);

  const response = await makeRequest(options, data);
  
  if (response.statusCode === 200 && response.data.userId) {
    console.log('\nLogin successful:');
    console.log('User ID:', response.data.userId);
    return { success: true, userId: response.data.userId };
  } else {
    console.log('\nLogin failed:');
    console.log('Error:', response.data?.error || 'Unknown error');
    return { success: false, error: response.data?.error || 'Unknown error' };
  }
};

// Run the test flow
const runTest = async () => {
  try {
    console.log('=== TESTING ZK IDENTITY FLOW ===');
    
    // Step 1: Generate a commitment
    console.log('\n=== STEP 1: GENERATE COMMITMENT ===');
    const commitment = await generateCommitment();
    
    // Step 2: Generate a proof
    console.log('\n=== STEP 2: GENERATE PROOF ===');
    const proofResponse = await generateProof(commitment);
    
    // Step 3: Create a user with the ZK commitment
    console.log('\n=== STEP 3: CREATE USER ===');
    let userId;
    try {
      userId = await createUser(commitment);
      console.log('User created with ID:', userId);
    } catch (error) {
      console.log('User creation failed, will attempt login anyway');
    }
    
    // Step 4: Attempt ZK login
    console.log('\n=== STEP 4: ATTEMPT ZK LOGIN ===');
    const loginResult = await attemptZkLogin(proofResponse, commitment);
    
    console.log('\n=== TEST RESULTS ===');
    console.log('Commitment Generated:', !!commitment);
    console.log('Proof Generated:', !!proofResponse.proof);
    console.log('User Created:', !!userId);
    console.log('Login Success:', loginResult.success);
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