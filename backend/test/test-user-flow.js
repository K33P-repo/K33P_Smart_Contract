import http from 'http';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';

const TEST_USER = {
  phoneNumber: '+2348012345678', // Changed to 13-digit format
  userId: 'test-user-' + Date.now(),
  walletAddress: '0x' + 'a'.repeat(40),
  pin: '123456',
  biometric: 'test_biometric_data',
  passkey: 'test_passkey_data'
};

let authToken = '';
let zkCommitment = '';
let zkProof = null;

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000
    };

    if (authToken) {
      options.headers.Authorization = `Bearer ${authToken}`;
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          if (responseData) {
            const parsed = JSON.parse(responseData);
            resolve({
              status: res.statusCode,
              body: parsed
            });
          } else {
            resolve({
              status: res.statusCode,
              body: null
            });
          }
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message} - Response: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request error: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

function generateSHA256Hash(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function testServerConnection() {
  console.log('\n=== Testing Server Connection ===');
  try {
    const response = await makeRequest('GET', '/api/health');
    console.log(`✅ Server responded with status: ${response.status}`);
    return true;
  } catch (error) {
    console.log(`❌ Server connection failed: ${error.message}`);
    return false;
  }
}

async function testGetZKCommitment() {
  console.log('\n=== Testing Get ZK Commitment ===');
  
  try {
    const commitmentData = {
      phone: TEST_USER.phoneNumber,
      biometric: TEST_USER.biometric,
      passkey: TEST_USER.passkey
    };

    console.log('Requesting ZK commitment...');
    const response = await makeRequest('POST', '/api/zk/commitment', commitmentData);
    
    console.log(`Status: ${response.status}`);
    
    if (response.body && response.body.success) {
      zkCommitment = response.body.data.commitment;
      console.log(`✅ ZK Commitment received: ${zkCommitment.substring(0, 20)}...`);
      console.log(`✅ Phone Hash: ${response.body.data.hashes.phoneHash.substring(0, 20)}...`);
      console.log(`✅ Biometric Hash: ${response.body.data.hashes.biometricHash.substring(0, 20)}...`);
      console.log(`✅ Passkey Hash: ${response.body.data.hashes.passkeyHash.substring(0, 20)}...`);
      return true;
    } else {
      console.log(`❌ Failed to get ZK commitment: ${response.body?.error?.message}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    return false;
  }
}

async function testGetZKProof() {
  console.log('\n=== Testing Get ZK Proof ===');
  
  try {
    if (!zkCommitment) {
      console.log('❌ No ZK commitment available');
      return false;
    }

    const proofData = {
      phone: TEST_USER.phoneNumber,
      biometric: TEST_USER.biometric,
      passkey: TEST_USER.passkey,
      commitment: zkCommitment
    };

    console.log('Requesting ZK proof...');
    const response = await makeRequest('POST', '/api/zk/proof', proofData);
    
    console.log(`Status: ${response.status}`);
    
    if (response.body && response.body.success) {
      zkProof = response.body.data;
      console.log(`✅ ZK Proof received`);
      console.log(`✅ Proof Valid: ${zkProof.isValid}`);
      console.log(`✅ Public Inputs Commitment: ${zkProof.publicInputs.commitment.substring(0, 20)}...`);
      return true;
    } else {
      console.log(`❌ Failed to get ZK proof: ${response.body?.error?.message}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    return false;
  }
}

async function testSignup() {
  console.log('\n=== Testing Signup ===');
  
  try {
    if (!zkCommitment || !zkProof) {
      console.log('❌ Missing ZK commitment or proof');
      return false;
    }

    const phoneHash = generateSHA256Hash(TEST_USER.phoneNumber);
    const pinHash = generateSHA256Hash(TEST_USER.pin);
    
    // Create consistent timestamps for auth methods
    const now = new Date().toISOString();
    const authMethods = [
      {
        type: 'pin',
        data: pinHash,
        createdAt: now,
        lastUsed: now
      },
      {
        type: 'face',
        data: generateSHA256Hash(TEST_USER.biometric),
        createdAt: now,
        lastUsed: now
      },
      {
        type: 'phone',
        data: phoneHash,
        createdAt: now,
        lastUsed: now
      }
    ];

    const signupData = {
      userId: TEST_USER.userId,
      userAddress: TEST_USER.walletAddress,
      phoneHash: phoneHash,
      pinHash: pinHash,
      authMethods: authMethods,
      zkCommitment: zkCommitment,
      zkProof: zkProof,
      verificationMethod: 'phone',
      phone: TEST_USER.phoneNumber // Make sure this is included
    };

    console.log('Sending signup request...');
    console.log('Signup data:', {
      userId: signupData.userId,
      phone: signupData.phone,
      hasPhoneHash: !!signupData.phoneHash,
      authMethodsCount: signupData.authMethods.length,
      hasZkCommitment: !!signupData.zkCommitment,
      hasZkProof: !!signupData.zkProof
    });

    const response = await makeRequest('POST', '/api/auth/signup', signupData);
    
    console.log(`Status: ${response.status}`);
    
    if (response.body) {
      console.log(`Success: ${response.body.success}`);
      
      if (response.body.success) {
        console.log(`✅ User ID: ${response.body.data.userId}`);
        console.log(`✅ Verified: ${response.body.data.verified}`);
        console.log(`✅ Auth Methods: ${response.body.data.authMethods?.length || 0}`);
        console.log(`✅ ZK Commitment: ${response.body.data.zkCommitment?.substring(0, 20)}...`);
        
        if (response.body.data.token) {
          authToken = response.body.data.token;
          console.log('✅ JWT Token stored');
        }
        
        return true;
      } else {
        console.log(`❌ Error: ${response.body.error?.message}`);
        console.log(`❌ Error Code: ${response.body.error?.code}`);
        console.log(`❌ Error Details: ${JSON.stringify(response.body.error?.details)}`);
        return false;
      }
    } else {
      console.log('❌ No response body received');
      return false;
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    return false;
  }
}

async function testFindUser() {
  console.log('\n=== Testing Find User ===');
  
  try {
    const phoneHash = generateSHA256Hash(TEST_USER.phoneNumber);
    
    console.log('Finding user with phone hash:', phoneHash.substring(0, 20) + '...');
    
    const response = await makeRequest('POST', '/api/zk/find-user', {
      phoneHash: phoneHash
    });
    
    console.log(`Status: ${response.status}`);
    
    if (response.body) {
      console.log(`Success: ${response.body.success}`);
      
      if (response.body.success) {
        console.log(`✅ User ID: ${response.body.data.userId}`);
        console.log(`✅ Wallet: ${response.body.data.walletAddress}`);
        console.log(`✅ Auth Methods: ${response.body.data.authMethods?.length || 0}`);
        console.log(`✅ ZK Commitment: ${response.body.data.zkCommitment?.substring(0, 20)}...`);
        
        // Store the actual auth methods from the response for login test
        if (response.body.data.authMethods) {
          TEST_USER.storedAuthMethods = response.body.data.authMethods;
          console.log('✅ Stored auth methods for login test');
        }
        
        return true;
      } else {
        console.log(`❌ Error: ${response.body.error?.message}`);
        return false;
      }
    } else {
      console.log('❌ No response body received');
      return false;
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    return false;
  }
}

async function testLoginWithPin() {
  console.log('\n=== Testing Login with PIN ===');
  
  try {
    const phoneHash = generateSHA256Hash(TEST_USER.phoneNumber);
    const pinHash = generateSHA256Hash(TEST_USER.pin);
    
    // Use the EXACT auth methods that were stored during signup
    let authMethods;
    if (TEST_USER.storedAuthMethods) {
      // Use the stored auth methods exactly as they are
      authMethods = TEST_USER.storedAuthMethods;
      console.log('✅ Using stored auth methods from find-user response');
    } else {
      // Fallback: create auth methods with the same structure
      const now = new Date().toISOString();
      authMethods = [
        {
          type: 'pin',
          data: pinHash,
          createdAt: now,
          lastUsed: now
        },
        {
          type: 'face',
          data: generateSHA256Hash(TEST_USER.biometric),
          createdAt: now,
          lastUsed: now
        },
        {
          type: 'phone',
          data: phoneHash,
          createdAt: now,
          lastUsed: now
        }
      ];
      console.log('⚠️ Using newly created auth methods (may not match stored)');
    }

    console.log('Login auth methods:', authMethods.map(m => ({
      type: m.type,
      hasData: !!m.data,
      createdAt: m.createdAt
    })));

    const loginData = {
      phoneHash: phoneHash,
      authMethod: 'pin',
      pinHash: pinHash,
      authMethods: authMethods
    };

    console.log('Sending login request...');
    const response = await makeRequest('POST', '/api/zk/login-with-pin', loginData);
    
    console.log(`Status: ${response.status}`);
    
    if (response.body) {
      console.log(`Success: ${response.body.success}`);
      
      if (response.body.success) {
        console.log(`✅ User ID: ${response.body.data.userId}`);
        console.log(`✅ Verified: ${response.body.data.verified}`);
        console.log(`✅ Auth Method: ${response.body.data.authMethod}`);
        
        if (response.body.data.token) {
          authToken = response.body.data.token;
          console.log('✅ JWT Token stored');
        }
        
        return true;
      } else {
        console.log(`❌ Error: ${response.body.error?.message}`);
        console.log(`❌ Error Details: ${JSON.stringify(response.body.error?.details)}`);
        return false;
      }
    } else {
      console.log('❌ No response body received');
      return false;
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    return false;
  }
}

async function testZKVerification() {
  console.log('\n=== Testing ZK Verification ===');
  
  try {
    if (!zkProof || !zkCommitment) {
      console.log('❌ Missing ZK proof or commitment');
      return false;
    }

    const verificationData = {
      proof: zkProof,
      commitment: zkCommitment
    };

    console.log('Verifying ZK proof...');
    const response = await makeRequest('POST', '/api/zk/verify', verificationData);
    
    console.log(`Status: ${response.status}`);
    
    if (response.body && response.body.success) {
      console.log(`✅ ZK Verification Result: ${response.body.data.isValid}`);
      return response.body.data.isValid;
    } else {
      console.log(`❌ Failed to verify ZK proof: ${response.body?.error?.message}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    return false;
  }
}

async function runCompleteTests() {
  console.log('Starting Complete Authentication Flow Tests...');
  console.log('Test User ID:', TEST_USER.userId);
  console.log('Test Phone:', TEST_USER.phoneNumber);
  console.log('='.repeat(50));
  
  const serverConnected = await testServerConnection();
  if (!serverConnected) {
    console.log('❌ Cannot run tests - server is not accessible');
    console.log('Make sure your server is running on http://localhost:3000');
    return;
  }
  
  const tests = [
    testGetZKCommitment,
    testGetZKProof,
    testZKVerification,
    testSignup,
    testFindUser,
    testLoginWithPin
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await test();
    if (result) {
      passed++;
      console.log('✅ Test PASSED');
    } else {
      failed++;
      console.log('❌ Test FAILED');
    }
    console.log('-'.repeat(30));
  }
  
  console.log('='.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('💥 Some tests failed');
  }
}

runCompleteTests().catch(console.error);