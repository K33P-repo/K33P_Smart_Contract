import http from 'http';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';

const TEST_USERS = {
  valid: {
    phoneNumber: '1234567890',
    userId: 'test-user-' + Date.now(),
    walletAddress: '0x' + 'a'.repeat(40),
    pin: '123456',
    biometric: 'test_biometric_data',
    passkey: 'test_passkey_data'
  },
  duplicateUserId: {
    phoneNumber: '0987654321',
    userId: 'duplicate-user-id',
    walletAddress: '0x' + 'b'.repeat(40),
    pin: '654321',
    biometric: 'test_biometric_2',
    passkey: 'test_passkey_2'
  },
  duplicatePhone: {
    phoneNumber: '1234567890', 
    userId: 'unique-user-' + Date.now(),
    walletAddress: '0x' + 'c'.repeat(40),
    pin: '111111',
    biometric: 'test_biometric_3',
    passkey: 'test_passkey_3'
  },
  invalid: {
    phoneNumber: '123',
    userId: 'ab',
    walletAddress: '0x123', 
    pin: '12',
    biometric: '',
    passkey: ''
  },
  missingFields: {
    // Intentionally missing required fields
  }
};

let authToken = '';
let zkCommitment = '';
let zkProof = null;
let aesKey = crypto.randomBytes(32);
let createdUsers = [];

function encryptAESDeterministic(data, key) {
  try {
    const algorithm = 'aes-256-gcm';
    const iv = Buffer.from('00000000000000000000000000000000', 'hex');
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('AES encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

function decryptAES(encryptedData, key) {
  try {
    const algorithm = 'aes-256-gcm';
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('AES decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

function isValidAESFormat(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string') return false;
  const parts = encryptedData.split(':');
  return parts.length === 3 && 
         parts[0].length === 32 &&
         parts[1].length === 32 &&
         parts[2].length > 0;
}

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

async function testGetZKCommitment(userData) {
  console.log(`\n=== Testing Get ZK Commitment for ${userData.userId} ===`);
  try {
    const commitmentData = {
      phone: userData.phoneNumber,
      biometric: userData.biometric,
      passkey: userData.passkey
    };

    const response = await makeRequest('POST', '/api/zk/commitment', commitmentData);
    
    if (response.body && response.body.success) {
      zkCommitment = response.body.data.commitment;
      console.log(`✅ ZK Commitment received: ${zkCommitment.substring(0, 20)}...`);
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

async function testGetZKProof(userData) {
  console.log(`\n=== Testing Get ZK Proof for ${userData.userId} ===`);
  try {
    if (!zkCommitment) {
      console.log('❌ No ZK commitment available');
      return false;
    }

    const proofData = {
      phone: userData.phoneNumber,
      biometric: userData.biometric,
      passkey: userData.passkey,
      commitment: zkCommitment
    };

    const response = await makeRequest('POST', '/api/zk/proof', proofData);
    
    if (response.body && response.body.success) {
      zkProof = response.body.data;
      console.log(`✅ ZK Proof received - Valid: ${zkProof.isValid}`);
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

async function testSignup(userData, expectSuccess = true) {
  console.log(`\n=== Testing Signup for ${userData.userId} (expect ${expectSuccess ? 'success' : 'failure'}) ===`);
  
  try {
    if (!zkCommitment || !zkProof) {
      console.log('❌ Missing ZK commitment or proof');
      return false;
    }

    const phoneEncrypted = encryptAESDeterministic(userData.phoneNumber, aesKey);
    const pinEncrypted = encryptAESDeterministic(userData.pin, aesKey);
    
    const now = new Date().toISOString();
    const authMethods = [
      {
        type: 'pin',
        data: pinEncrypted,
        createdAt: now,
        lastUsed: now
      },
      {
        type: 'fingerprint',
        createdAt: now,
        lastUsed: now
      },
      {
        type: 'phone',
        data: phoneEncrypted,
        createdAt: now,
        lastUsed: now
      }
    ];

    const signupData = {
      userId: userData.userId,
      userAddress: userData.walletAddress,
      phoneHash: phoneEncrypted,
      pinHash: pinEncrypted,
      authMethods: authMethods,
      zkCommitment: zkCommitment,
      zkProof: zkProof,
      verificationMethod: 'phone',
    };

    const response = await makeRequest('POST', '/api/auth/signup', signupData);
    
    if (response.body) {
      if (response.body.success && expectSuccess) {
        console.log(`✅ Signup successful: ${response.body.data.userId}`);
        if (response.body.data.token) {
          authToken = response.body.data.token;
        }
        createdUsers.push(userData.userId);
        return true;
      } else if (!response.body.success && !expectSuccess) {
        console.log(`✅ Expected failure occurred: ${response.body.error?.message}`);
        return true;
      } else {
        console.log(`❌ Unexpected result: ${response.body.success ? 'success' : 'failure'}`);
        console.log(`Error: ${response.body.error?.message}`);
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

async function testFindUser(userData) {
  console.log(`\n=== Testing Find User for ${userData.phoneNumber} ===`);
  
  try {
    if (!aesKey) {
      console.log('❌ No AES key available for encryption');
      return false;
    }

    const phoneEncrypted = encryptAESDeterministic(userData.phoneNumber, aesKey);
    
    const response = await makeRequest('POST', '/api/zk/find-user', {
      phoneHash: phoneEncrypted
    });
    
    if (response.body) {
      if (response.body.success) {
        console.log(`✅ User found: ${response.body.data.userId}`);
        if (response.body.data.authMethods) {
          userData.storedAuthMethods = response.body.data.authMethods;
        }
        return true;
      } else {
        console.log(`❌ User not found: ${response.body.error?.message}`);
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

async function testLoginWithPin(userData) {
  console.log(`\n=== Testing Login with PIN for ${userData.userId} ===`);
  
  try {
    if (!aesKey) {
      console.log('❌ No AES key available for encryption');
      return false;
    }

    const phoneEncrypted = encryptAESDeterministic(userData.phoneNumber, aesKey);
    const pinEncrypted = encryptAESDeterministic(userData.pin, aesKey);
    
    let authMethods = userData.storedAuthMethods;
    if (!authMethods) {
      const now = new Date().toISOString();
      authMethods = [
        {
          type: 'pin',
          data: pinEncrypted,
          createdAt: now,
          lastUsed: now
        },
        {
          type: 'fingerprint',
          createdAt: now,
          lastUsed: now
        },
        {
          type: 'phone',
          data: phoneEncrypted,
          createdAt: now,
          lastUsed: now
        }
      ];
    }

    const loginData = {
      phoneHash: phoneEncrypted,
      authMethod: 'pin',
      pinHash: pinEncrypted,
      authMethods: authMethods
    };

    const response = await makeRequest('POST', '/api/zk/login-with-pin', loginData);
    
    if (response.body) {
      if (response.body.success) {
        console.log(`✅ Login successful: ${response.body.data.userId}`);
        if (response.body.data.token) {
          authToken = response.body.data.token;
        }
        return true;
      } else {
        console.log(`❌ Login failed: ${response.body.error?.message}`);
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

async function testInvalidSignupScenarios() {
  console.log('\n=== Testing Invalid Signup Scenarios ===');
  
  const scenarios = [
    {
      name: 'Missing required fields',
      data: TEST_USERS.missingFields,
      expectedError: 'Missing required fields'
    },
    {
      name: 'Invalid user ID (too short)',
      data: TEST_USERS.invalid,
      expectedError: 'User ID must be between 3 and 50 characters'
    },
    {
      name: 'Invalid phone number (too short)',
      data: { ...TEST_USERS.valid, phoneNumber: TEST_USERS.invalid.phoneNumber },
      expectedError: 'Phone encrypted data is required'
    },
    {
      name: 'Missing auth methods',
      data: { ...TEST_USERS.valid, authMethods: null },
      expectedError: 'At least 3 authentication methods are required'
    },
    {
      name: 'Insufficient auth methods',
      data: { ...TEST_USERS.valid, authMethods: [{ type: 'pin', createdAt: new Date().toISOString() }] },
      expectedError: 'At least 3 authentication methods are required'
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const scenario of scenarios) {
    console.log(`\nTesting: ${scenario.name}`);
    try {
      const response = await makeRequest('POST', '/api/auth/signup', scenario.data);
      
      if (response.body && !response.body.success) {
        console.log(`✅ Expected failure: ${response.body.error?.message}`);
        passed++;
      } else {
        console.log(`❌ Expected failure but got success`);
        failed++;
      }
    } catch (error) {
      console.log(`✅ Expected error: ${error.message}`);
      passed++;
    }
  }

  console.log(`\nInvalid scenarios: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

async function testDuplicateUserScenarios() {
  console.log('\n=== Testing Duplicate User Scenarios ===');
  
  // First, create a user that we'll duplicate
  const originalUser = { ...TEST_USERS.valid, userId: 'original-user-' + Date.now() };
  
  console.log('Creating original user for duplication tests...');
  const commitmentSuccess = await testGetZKCommitment(originalUser);
  const proofSuccess = await testGetZKProof(originalUser);
  const signupSuccess = await testSignup(originalUser, true);
  
  if (!signupSuccess) {
    console.log('❌ Failed to create original user for duplication tests');
    return false;
  }

  const scenarios = [
    {
      name: 'Duplicate User ID',
      user: { 
        ...TEST_USERS.duplicateUserId, 
        userId: originalUser.userId, // Same user ID
        phoneNumber: '0987654321' // Different phone
      },
      expectedError: 'User ID already exists'
    },
    {
      name: 'Duplicate Phone Number', 
      user: {
        ...TEST_USERS.duplicatePhone,
        phoneNumber: originalUser.phoneNumber, // Same phone
        userId: 'different-user-' + Date.now() // Different user ID
      },
      expectedError: 'Phone number already registered'
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const scenario of scenarios) {
    console.log(`\nTesting: ${scenario.name}`);
    
    const commitmentSuccess = await testGetZKCommitment(scenario.user);
    const proofSuccess = await testGetZKProof(scenario.user);
    
    if (commitmentSuccess && proofSuccess) {
      const signupSuccess = await testSignup(scenario.user, false);
      if (signupSuccess) {
        passed++;
      } else {
        failed++;
      }
    } else {
      failed++;
    }
  }

  console.log(`\nDuplicate scenarios: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

async function testMultipleValidUsers() {
  console.log('\n=== Testing Multiple Valid Users ===');
  
  const users = [
    { ...TEST_USERS.valid, userId: 'multi-user-1-' + Date.now(), phoneNumber: '1112223333' },
    { ...TEST_USERS.valid, userId: 'multi-user-2-' + Date.now(), phoneNumber: '4445556666' },
    { ...TEST_USERS.valid, userId: 'multi-user-3-' + Date.now(), phoneNumber: '7778889999' }
  ];

  let passed = 0;
  let failed = 0;

  for (const user of users) {
    console.log(`\nTesting user: ${user.userId}`);
    
    const commitmentSuccess = await testGetZKCommitment(user);
    const proofSuccess = await testGetZKProof(user);
    const signupSuccess = await testSignup(user, true);
    const findSuccess = await testFindUser(user);
    const loginSuccess = await testLoginWithPin(user);
    
    if (commitmentSuccess && proofSuccess && signupSuccess && findSuccess && loginSuccess) {
      passed++;
      console.log(`✅ All operations successful for ${user.userId}`);
    } else {
      failed++;
      console.log(`❌ Some operations failed for ${user.userId}`);
    }
  }

  console.log(`\nMultiple users: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

async function testDataPersistence() {
  console.log('\n=== Testing Data Persistence ===');
  
  const testUser = { 
    ...TEST_USERS.valid, 
    userId: 'persistence-test-' + Date.now(),
    phoneNumber: '9998887777'
  };

  console.log('Creating user and testing persistence...');
  
  // Create user
  const commitmentSuccess = await testGetZKCommitment(testUser);
  const proofSuccess = await testGetZKProof(testUser);
  const signupSuccess = await testSignup(testUser, true);
  
  if (!signupSuccess) {
    console.log('❌ Failed to create user for persistence test');
    return false;
  }

  // Clear in-memory data to simulate fresh start
  const savedAuthToken = authToken;
  authToken = '';
  zkCommitment = '';
  zkProof = null;
  
  console.log('Cleared in-memory data, testing find user...');
  
  // Test finding user (should work without previous session)
  const findSuccess = await testFindUser(testUser);
  
  if (findSuccess) {
    console.log('✅ User found after clearing session data');
    
    // Test login with found user data
    const loginSuccess = await testLoginWithPin(testUser);
    
    if (loginSuccess) {
      console.log('✅ Login successful with persisted data');
      return true;
    } else {
      console.log('❌ Login failed with persisted data');
      return false;
    }
  } else {
    console.log('❌ User not found after clearing session data');
    return false;
  }
}

async function runComprehensiveTests() {
  console.log('Starting Comprehensive Authentication Flow Tests...');
  console.log('='.repeat(60));
  
  const serverConnected = await testServerConnection();
  if (!serverConnected) {
    console.log('❌ Cannot run tests - server is not accessible');
    return;
  }

  const testSuites = [
    { name: 'Invalid Signup Scenarios', test: testInvalidSignupScenarios },
    { name: 'Duplicate User Scenarios', test: testDuplicateUserScenarios },
    { name: 'Multiple Valid Users', test: testMultipleValidUsers },
    { name: 'Data Persistence', test: testDataPersistence }
  ];

  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of testSuites) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Running: ${suite.name}`);
    console.log('='.repeat(50));
    
    const result = await suite.test();
    if (result) {
      totalPassed++;
      console.log(`✅ ${suite.name}: PASSED`);
    } else {
      totalFailed++;
      console.log(`❌ ${suite.name}: FAILED`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('COMPREHENSIVE TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`Total Test Suites: ${testSuites.length}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  
  if (totalFailed === 0) {
    console.log('🎉 ALL COMPREHENSIVE TESTS PASSED!');
  } else {
    console.log('💥 SOME TESTS FAILED - NEEDS INVESTIGATION');
  }

  // Cleanup: List created users for manual verification
  if (createdUsers.length > 0) {
    console.log(`\nCreated test users: ${createdUsers.join(', ')}`);
  }
}

// Run comprehensive tests
runComprehensiveTests().catch(console.error);