import http from 'http';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';

// Generate a consistent test user ID for the entire test run
const TEST_USER_ID = 'test-user-' + Date.now();

const TEST_USER = {
    phoneNumber: '1234567890',
  userId: TEST_USER_ID,
  walletAddress: '0x' + 'a'.repeat(40),
  pin: '123456',
  biometric: 'test_biometric_data',
  passkey: 'test_passkey_data'
};

let authToken = '';
let zkCommitment = '';
let zkProof = null;
let aesKey = null;

// Deterministic AES encryption utility with FIXED IV
function encryptAESDeterministic(data, key) {
  try {
    const algorithm = 'aes-256-gcm';
    // FIXED IV - makes encryption deterministic (16 bytes of zeros)
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

// AES decryption utility
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

// Helper to validate AES encrypted data format
function isValidAESFormat(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string') return false;
  const parts = encryptedData.split(':');
  return parts.length === 3 && 
         parts[0].length === 32 && // IV (16 bytes in hex)
         parts[1].length === 32 && // Auth tag (16 bytes in hex)
         parts[2].length > 0;      // Encrypted data
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

    // Generate AES key
    aesKey = crypto.randomBytes(32); // 32 bytes for AES-256

    // Encrypt phone and PIN data using DETERMINISTIC encryption
    const phoneEncrypted = encryptAESDeterministic(TEST_USER.phoneNumber, aesKey);
    const pinEncrypted = encryptAESDeterministic(TEST_USER.pin, aesKey);
    
    console.log('Encrypted data created (deterministic):', {
      phoneEncrypted: phoneEncrypted.substring(0, 20) + '...',
      pinEncrypted: pinEncrypted.substring(0, 20) + '...',
      phoneValid: isValidAESFormat(phoneEncrypted),
      pinValid: isValidAESFormat(pinEncrypted)
    });

    // Test deterministic property
    const phoneEncrypted2 = encryptAESDeterministic(TEST_USER.phoneNumber, aesKey);
    const pinEncrypted2 = encryptAESDeterministic(TEST_USER.pin, aesKey);
    console.log('Deterministic test - same inputs produce same outputs:', {
      phoneMatch: phoneEncrypted === phoneEncrypted2,
      pinMatch: pinEncrypted === pinEncrypted2
    });

    // Create consistent timestamps for auth methods
    const now = new Date().toISOString();
    const authMethods = [
      {
        type: 'pin',
        data: pinEncrypted, // Store encrypted PIN data
        createdAt: now,
        lastUsed: now
      },
      {
        type: 'face',
        data: generateSHA256Hash(TEST_USER.biometric), // Keep biometric as hash
        createdAt: now,
        lastUsed: now
      },
      {
        type: 'phone',
        data: phoneEncrypted, // Store encrypted phone data
        createdAt: now,
        lastUsed: now
      }
    ];

    const signupData = {
      userId: TEST_USER.userId,
      userAddress: TEST_USER.walletAddress,
      phoneHash: phoneEncrypted, // Send encrypted phone as phoneHash
      pinHash: pinEncrypted,     // Send encrypted PIN as pinHash
      authMethods: authMethods,
      zkCommitment: zkCommitment,
      zkProof: zkProof,
      verificationMethod: 'phone',
    };

    console.log('Sending signup request...');
    console.log('Signup data fields:', {
      userId: signupData.userId,
      hasPhoneHash: !!signupData.phoneHash,
      hasPinHash: !!signupData.pinHash,
      phoneHashLength: signupData.phoneHash?.length,
      pinHashLength: signupData.pinHash?.length,
      phoneHashFormat: isValidAESFormat(signupData.phoneHash),
      pinHashFormat: isValidAESFormat(signupData.pinHash),
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
        
        // Update TEST_USER with the actual user ID from response
        if (response.body.data.userId && response.body.data.userId !== TEST_USER.userId) {
          console.log(`⚠️ User ID changed from ${TEST_USER.userId} to ${response.body.data.userId}`);
          TEST_USER.userId = response.body.data.userId;
        }
        
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
    if (!aesKey) {
      console.log('❌ No AES key available for encryption');
      return false;
    }

    // Encrypt phone number using the SAME deterministic encryption
    const phoneEncrypted = encryptAESDeterministic(TEST_USER.phoneNumber, aesKey);
    
    console.log('Finding user with encrypted phone:', phoneEncrypted.substring(0, 20) + '...');
    console.log('AES Format Valid:', isValidAESFormat(phoneEncrypted));
    console.log('Current User ID:', TEST_USER.userId);
    
    const response = await makeRequest('POST', '/api/zk/find-user', {
      phoneHash: phoneEncrypted // Send as phoneHash field
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
        console.log(`❌ Error Details: ${response.body.error?.details}`);
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
    if (!aesKey) {
      console.log('❌ No AES key available for encryption');
      return false;
    }

    // Encrypt phone and PIN data using the SAME deterministic encryption
    const phoneEncrypted = encryptAESDeterministic(TEST_USER.phoneNumber, aesKey);
    const pinEncrypted = encryptAESDeterministic(TEST_USER.pin, aesKey);
    
    console.log('Encrypted data validation:', {
      phoneEncrypted: isValidAESFormat(phoneEncrypted),
      pinEncrypted: isValidAESFormat(pinEncrypted),
      phoneLength: phoneEncrypted.length,
      pinLength: pinEncrypted.length
    });

    // Use the EXACT auth methods that were stored during signup
    let authMethods;
    if (TEST_USER.storedAuthMethods) {
      // Use the stored auth methods exactly as they are
      authMethods = TEST_USER.storedAuthMethods;
      console.log('✅ Using stored auth methods from find-user response');
    } else {
      // Fallback: create auth methods with encrypted data
      const now = new Date().toISOString();
      authMethods = [
        {
          type: 'pin',
          data: pinEncrypted, // Use encrypted PIN
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
          data: phoneEncrypted, // Use encrypted phone
          createdAt: now,
          lastUsed: now
        }
      ];
      console.log('⚠️ Using newly created auth methods (may not match stored)');
    }

    console.log('Login auth methods:', authMethods.map(m => ({
      type: m.type,
      dataLength: m.data?.length,
      createdAt: m.createdAt
    })));

    const loginData = {
      phoneHash: phoneEncrypted, 
      authMethod: 'pin',
      pinHash: pinEncrypted,     
      authMethods: authMethods
    };

    console.log('Sending login request...');
    console.log('Login data fields:', {
      hasPhoneHash: !!loginData.phoneHash,
      hasPinHash: !!loginData.pinHash,
      phoneHashLength: loginData.phoneHash?.length,
      pinHashLength: loginData.pinHash?.length,
      authMethodsCount: loginData.authMethods.length
    });

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

// Test deterministic AES encryption
console.log('Testing Deterministic AES encryption...');
const testKey = crypto.randomBytes(32);
const testData = 'test data';
const encrypted1 = encryptAESDeterministic(testData, testKey);
const encrypted2 = encryptAESDeterministic(testData, testKey);
const encrypted3 = encryptAESDeterministic(testData, testKey);
const decrypted = decryptAES(encrypted1, testKey);

console.log('Deterministic AES Test:', {
  original: testData,
  encrypted1: encrypted1.substring(0, 20) + '...',
  encrypted2: encrypted2.substring(0, 20) + '...', 
  encrypted3: encrypted3.substring(0, 20) + '...',
  allEqual: encrypted1 === encrypted2 && encrypted2 === encrypted3,
  decrypted: decrypted,
  valid: testData === decrypted,
  formatValid: isValidAESFormat(encrypted1)
});

runCompleteTests().catch(console.error);