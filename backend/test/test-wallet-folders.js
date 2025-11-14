#!/usr/bin/env node
/**
 * Combined Authentication & Wallet Folders Test - PROPER DELETE HANDLING
 */

import http from 'http';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';

// Use the SAME user ID format as your working test
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
let storedAuthMethods = null;

// Test state for wallet folders
let testFolderId = '';
let testWalletId = '';
let createdFolders = [];
let createdWallets = [];

// Deterministic AES encryption utility with FIXED IV
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

function makeRequest(method, path, data = null, customTimeout = 30000) { // Default 30s timeout
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: customTimeout
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
      reject(new Error(`Request timeout after ${customTimeout}ms for ${method} ${path}`));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test cases
class CombinedTests {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }

  addTest(name, fn) {
    this.tests.push({ name, fn });
  }

  async runAll() {
    console.log('🧪 Starting Combined Authentication & Wallet Folders Tests...\n');
    console.log(`📡 Testing against: ${BASE_URL}\n`);
    
    for (const test of this.tests) {
      try {
        process.stdout.write(`⏳ Running: ${test.name}... `);
        await test.fn();
        console.log(`✅ PASS`);
        this.passed++;
      } catch (error) {
        console.log(`❌ FAIL`);
        console.log(`   Error: ${error.message}`);
        this.failed++;
      }
    }

    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Total: ${this.tests.length}`);
    console.log(`🎯 Success Rate: ${((this.passed / this.tests.length) * 100).toFixed(1)}%`);
    
    if (this.failed === 0) {
      console.log('\n🎉 All tests passed! Complete flow is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Check the errors above.');
    }
  }
}

// Create test suite
const tests = new CombinedTests();

// ============================================================================
// AUTHENTICATION TESTS
// ============================================================================

tests.addTest('Server connectivity', async () => {
  const response = await makeRequest('GET', '/api/health');
  
  if (response.status !== 200) {
    throw new Error(`Server not responding: ${response.status}`);
  }

  if (!response.body.success) {
    throw new Error('Health check failed');
  }
});

tests.addTest('Get ZK Commitment', async () => {
  const commitmentData = {
    phone: TEST_USER.phoneNumber,
    biometric: TEST_USER.biometric,
    passkey: TEST_USER.passkey
  };

  const response = await makeRequest('POST', '/api/zk/commitment', commitmentData);
  
  if (response.status !== 200) {
    throw new Error(`Failed to get ZK commitment: ${response.status}`);
  }

  if (!response.body.success) {
    throw new Error(`ZK commitment error: ${response.body.error?.message}`);
  }

  zkCommitment = response.body.data.commitment;
  console.log(`   🔐 Got ZK commitment: ${zkCommitment.substring(0, 20)}...`);
});

tests.addTest('Get ZK Proof', async () => {
  if (!zkCommitment) {
    throw new Error('No ZK commitment available');
  }

  const proofData = {
    phone: TEST_USER.phoneNumber,
    biometric: TEST_USER.biometric,
    passkey: TEST_USER.passkey,
    commitment: zkCommitment
  };

  const response = await makeRequest('POST', '/api/zk/proof', proofData);
  
  if (response.status !== 200) {
    throw new Error(`Failed to get ZK proof: ${response.status}`);
  }

  if (!response.body.success) {
    throw new Error(`ZK proof error: ${response.body.error?.message}`);
  }

  zkProof = response.body.data;
  console.log(`   🔐 Got ZK proof, valid: ${zkProof.isValid}`);
});

tests.addTest('User Signup', async () => {
  if (!zkCommitment || !zkProof) {
    throw new Error('Missing ZK commitment or proof');
  }

  // Generate AES key
  aesKey = crypto.randomBytes(32);

  // Encrypt phone and PIN data using DETERMINISTIC encryption
  const phoneEncrypted = encryptAESDeterministic(TEST_USER.phoneNumber, aesKey);
  const pinEncrypted = encryptAESDeterministic(TEST_USER.pin, aesKey);
  
  console.log('Encrypted data created (deterministic):', {
    phoneEncrypted: phoneEncrypted.substring(0, 20) + '...',
    pinEncrypted: pinEncrypted.substring(0, 20) + '...'
  });

  // Create consistent timestamps for auth methods
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
    userId: TEST_USER.userId,
    userAddress: TEST_USER.walletAddress,
    phoneHash: phoneEncrypted,
    pinHash: pinEncrypted,
    authMethods: authMethods,
    zkCommitment: zkCommitment,
    zkProof: zkProof,
    verificationMethod: 'phone',
  };

  console.log('Sending signup request...');
  const response = await makeRequest('POST', '/api/auth/signup', signupData);
  
  console.log(`Signup response status: ${response.status}`);
  
  if (response.body) {
    console.log(`Signup success: ${response.body.success}`);
    
    if (response.body.success) {
      console.log(`✅ User ID: ${response.body.data.userId}`);
      console.log(`✅ Verified: ${response.body.data.verified}`);
      console.log(`✅ Auth Methods: ${response.body.data.authMethods?.length || 0}`);
      
      // Update TEST_USER with the actual user ID from response
      if (response.body.data.userId && response.body.data.userId !== TEST_USER.userId) {
        console.log(`⚠️ User ID changed from ${TEST_USER.userId} to ${response.body.data.userId}`);
        TEST_USER.userId = response.body.data.userId;
      }
      
      if (response.body.data.token) {
        authToken = response.body.data.token;
        console.log('✅ JWT Token stored from signup');
      } else {
        console.log('⚠️ No token from signup, will use find-user + login flow');
      }
    } else {
      console.log(`❌ Signup error: ${response.body.error?.message}`);
      throw new Error('Signup failed');
    }
  } else {
    throw new Error('No response body received from signup');
  }
});

tests.addTest('Find User to get stored auth methods', async () => {
  if (!aesKey) {
    throw new Error('No AES key available for encryption');
  }

  // Encrypt phone number using the SAME deterministic encryption
  const phoneEncrypted = encryptAESDeterministic(TEST_USER.phoneNumber, aesKey);
  
  console.log('Finding user with encrypted phone:', phoneEncrypted.substring(0, 20) + '...');
  console.log('Current User ID:', TEST_USER.userId);
  
  const response = await makeRequest('POST', '/api/zk/find-user', {
    phoneHash: phoneEncrypted
  });
  
  console.log(`Find user status: ${response.status}`);
  
  if (response.body) {
    console.log(`Find user success: ${response.body.success}`);
    
    if (response.body.success) {
      console.log(`✅ User ID: ${response.body.data.userId}`);
      console.log(`✅ Wallet: ${response.body.data.walletAddress}`);
      console.log(`✅ Auth Methods: ${response.body.data.authMethods?.length || 0}`);
      
      // Store the actual auth methods from the response for login test
      if (response.body.data.authMethods) {
        storedAuthMethods = response.body.data.authMethods;
        console.log('✅ Stored auth methods for login test');
      } else {
        throw new Error('No auth methods found in user data');
      }
    } else {
      throw new Error(`Find user failed: ${response.body.error?.message}`);
    }
  } else {
    throw new Error('No response body received from find-user');
  }
});

tests.addTest('Login with PIN using stored auth methods', async () => {
  if (!aesKey) {
    throw new Error('No AES key available for encryption');
  }

  // Encrypt phone and PIN data using the SAME deterministic encryption
  const phoneEncrypted = encryptAESDeterministic(TEST_USER.phoneNumber, aesKey);
  const pinEncrypted = encryptAESDeterministic(TEST_USER.pin, aesKey);
  
  console.log('Encrypted data validation:', {
    phoneEncrypted: phoneEncrypted.substring(0, 20) + '...',
    pinEncrypted: pinEncrypted.substring(0, 20) + '...'
  });

  // Use the EXACT auth methods that were stored during find-user
  let authMethods;
  if (storedAuthMethods) {
    // Use the stored auth methods exactly as they are
    authMethods = storedAuthMethods;
    console.log('✅ Using stored auth methods from find-user response');
  } else {
    throw new Error('No stored auth methods available for login');
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
  const response = await makeRequest('POST', '/api/zk/login-with-pin', loginData);
  
  console.log(`Login response status: ${response.status}`);
  
  if (response.body) {
    console.log(`Login success: ${response.body.success}`);
    
    if (response.body.success) {
      console.log(`✅ User ID: ${response.body.data.userId}`);
      console.log(`✅ Verified: ${response.body.data.verified}`);
      console.log(`✅ Auth Method: ${response.body.data.authMethod}`);
      
      if (response.body.data.token) {
        authToken = response.body.data.token;
        console.log('✅ JWT Token stored from login');
      } else {
        throw new Error('No JWT token received from login');
      }
    } else {
      throw new Error(`Login failed: ${response.body.error?.message}`);
    }
  } else {
    throw new Error('No response body received from login');
  }
});

tests.addTest('Verify Authentication', async () => {
  if (!authToken) {
    throw new Error('No authentication token available');
  }
  
  console.log(`   ✅ Authentication verified with token`);
  console.log(`   ✅ User ID: ${TEST_USER.userId}`);
});

// ============================================================================
// WALLET FOLDERS TESTS - WITH PROPER DELETE HANDLING
// ============================================================================

tests.addTest('Get initial wallet folders', async () => {
  const response = await makeRequest('GET', '/api/wallet-folders');

  if (response.status !== 200) {
    throw new Error(`Failed to get folders: ${response.status} - ${response.body?.message}`);
  }

  if (!response.body.success) {
    throw new Error(`API error: ${response.body.message}`);
  }

  console.log(`   📁 Found ${response.body.data.folders?.length || 0} folders`);
  console.log(`   👛 Found ${response.body.data.totalWallets || 0} total wallets`);
});

tests.addTest('Create folder with default name (K33P Wallets)', async () => {
  const response = await makeRequest('POST', '/api/wallet-folders/folders', {
    // No name provided - should use default "K33P Wallets"
  });

  if (response.status !== 201) {
    throw new Error(`Failed to create folder: ${response.status} - ${JSON.stringify(response.body)}`);
  }

  if (response.body.data.name !== 'K33P Wallets') {
    throw new Error(`Default name not applied. Expected "K33P Wallets", got: "${response.body.data.name}"`);
  }

  testFolderId = response.body.data.id;
  createdFolders.push(testFolderId);
  
  console.log(`   📁 Created folder: ${response.body.data.name} (ID: ${testFolderId})`);
});

tests.addTest('Create folder with custom name', async () => {
  const response = await makeRequest('POST', '/api/wallet-folders/folders', {
    name: 'My Custom Folder'
  });

  if (response.status !== 201) {
    throw new Error(`Failed to create custom folder: ${response.status} - ${response.body.message}`);
  }

  createdFolders.push(response.body.data.id);
  console.log(`   📁 Created custom folder: ${response.body.data.name}`);
});

tests.addTest('Add wallet to folder (name only - no keyType/fileId)', async () => {
  const response = await makeRequest('POST', `/api/wallet-folders/folders/${testFolderId}/wallets`, {
    name: 'Test Ethereum Wallet'
    // No keyType or fileId - should work with just name
  });

  if (response.status !== 201) {
    throw new Error(`Failed to add wallet: ${response.status} - ${response.body.message}`);
  }

  testWalletId = response.body.data.id;
  createdWallets.push({ folderId: testFolderId, walletId: testWalletId });
  
  console.log(`   👛 Added wallet: ${response.body.data.name} (ID: ${testWalletId})`);
  console.log(`   🔑 KeyType: ${response.body.data.keyType || 'Not set'}`);
  console.log(`   📁 FileId: ${response.body.data.fileId || 'Not set'}`);
});

tests.addTest('Update wallet with recovery data (keyType + fileId)', async () => {
  const response = await makeRequest('PUT', `/api/wallet-folders/folders/${testFolderId}/wallets/${testWalletId}`, {
    name: 'Updated Wallet Name',
    keyType: '12',
    fileId: 'test_file_123'
  });

  if (response.status !== 200) {
    throw new Error(`Failed to update wallet: ${response.status} - ${response.body.message}`);
  }

  console.log(`   ✏️  Updated wallet to: ${response.body.data.name}`);
  console.log(`   🔑 KeyType set to: ${response.body.data.keyType}`);
  console.log(`   📁 FileId set to: ${response.body.data.fileId}`);
});

tests.addTest('Add recovery data via dedicated endpoint', async () => {
  const response = await makeRequest('PATCH', `/api/wallet-folders/folders/${testFolderId}/wallets/${testWalletId}/recovery`, {
    keyType: '24',
    fileId: 'recovery_file_456'
  });

  if (response.status !== 200) {
    throw new Error(`Failed to add recovery data: ${response.status} - ${response.body.message}`);
  }

  console.log(`   🔐 Added recovery data via PATCH endpoint`);
  console.log(`   🔑 KeyType: ${response.body.data.keyType}`);
  console.log(`   📁 FileId: ${response.body.data.fileId}`);
});

tests.addTest('Update wallet name only (no recovery data)', async () => {
  const response = await makeRequest('PUT', `/api/wallet-folders/folders/${testFolderId}/wallets/${testWalletId}`, {
    name: 'Final Wallet Name'
    // No keyType or fileId - should only update name
  });

  if (response.status !== 200) {
    throw new Error(`Failed to update wallet name: ${response.status} - ${response.body.message}`);
  }

  console.log(`   ✏️  Updated wallet name to: ${response.body.data.name}`);
  console.log(`   🔑 KeyType preserved: ${response.body.data.keyType}`);
  console.log(`   📁 FileId preserved: ${response.body.data.fileId}`);
});

tests.addTest('Add another wallet with just name', async () => {
  const response = await makeRequest('POST', `/api/wallet-folders/folders/${testFolderId}/wallets`, {
    name: 'Second Test Wallet'
    // No keyType or fileId
  });

  if (response.status !== 201) {
    throw new Error(`Failed to add second wallet: ${response.status} - ${response.body.message}`);
  }

  const secondWalletId = response.body.data.id;
  createdWallets.push({ folderId: testFolderId, walletId: secondWalletId });
  
  console.log(`   👛 Added second wallet: ${response.body.data.name} (ID: ${secondWalletId})`);
  console.log(`   🔑 KeyType: ${response.body.data.keyType || 'Not set'}`);
  console.log(`   📁 FileId: ${response.body.data.fileId || 'Not set'}`);
});

tests.addTest('Get updated wallet folders', async () => {
  const response = await makeRequest('GET', '/api/wallet-folders');

  if (response.status !== 200) {
    throw new Error(`Failed to get folders: ${response.status} - ${response.body?.message}`);
  }

  if (!response.body.success) {
    throw new Error(`API error: ${response.body.message}`);
  }

  const currentFolder = response.body.data.folders?.find(f => f.id === testFolderId);
  const walletCount = currentFolder?.items?.length || 0;
  
  console.log(`   📁 Folder "${currentFolder?.name}" has ${walletCount} wallets`);
  
  // Check wallet details
  if (currentFolder?.items) {
    currentFolder.items.forEach(wallet => {
      console.log(`     👛 ${wallet.name} - KeyType: ${wallet.keyType || 'None'} - FileId: ${wallet.fileId || 'None'}`);
    });
  }
});

tests.addTest('Delete wallet WITHOUT fileId (fast operation)', async () => {
  // First, let's create a wallet without fileId to test deletion
  const walletResponse = await makeRequest('POST', `/api/wallet-folders/folders/${testFolderId}/wallets`, {
    name: 'Wallet Without FileId'
  });

  if (walletResponse.status !== 201) {
    throw new Error(`Failed to create test wallet: ${walletResponse.status}`);
  }

  const tempWalletId = walletResponse.body.data.id;
  
  console.log(`   👛 Created test wallet without fileId: ${tempWalletId}`);
  
  // Now delete it - this should work without calling vault (fast)
  const response = await makeRequest('DELETE', `/api/wallet-folders/folders/${testFolderId}/wallets/${tempWalletId}`);
  
  if (response.status !== 200) {
    throw new Error(`Failed to delete wallet without fileId: ${response.status} - ${response.body?.message}`);
  }

  console.log(`   🗑️  Successfully deleted wallet without fileId: ${tempWalletId}`);
});

tests.addTest('Delete wallet WITH fileId (longer timeout for vault)', async () => {
  console.log(`   ⏳ Deleting wallet with fileId (may take up to 60s for vault operation)...`);
  
  // Use much longer timeout for wallet with fileId (vault operation)
  const response = await makeRequest('DELETE', `/api/wallet-folders/folders/${testFolderId}/wallets/${testWalletId}`, null, 60000); // 60s timeout
  
  if (response.status !== 200) {
    throw new Error(`Failed to delete wallet with fileId: ${response.status} - ${response.body?.message}`);
  }

  console.log(`   🗑️  Successfully deleted wallet with fileId: ${testWalletId}`);
  console.log(`   ✅ Vault deletion completed successfully`);
});

tests.addTest('Delete folder (may also call vault)', async () => {
  console.log(`   ⏳ Deleting folder (may take time for vault cleanup)...`);
  
  const response = await makeRequest('DELETE', `/api/wallet-folders/folders/${testFolderId}`, null, 60000); // 60s timeout
  
  if (response.status !== 200) {
    throw new Error(`Failed to delete folder: ${response.status} - ${response.body.message}`);
  }

  console.log(`   🗑️  Successfully deleted folder: ${testFolderId}`);
});

tests.addTest('Clean up remaining test data', async () => {
  let cleanedCount = 0;
  
  for (const folderId of createdFolders) {
    try {
      console.log(`   ⏳ Cleaning up folder: ${folderId}...`);
      const response = await makeRequest('DELETE', `/api/wallet-folders/folders/${folderId}`, null, 60000);
      if (response.status === 200) {
        cleanedCount++;
        console.log(`   ✅ Cleaned up folder: ${folderId}`);
      }
    } catch (error) {
      // Ignore errors during cleanup, but log them
      console.log(`   ⚠️  Could not clean up folder ${folderId}: ${error.message}`);
    }
  }
  
  console.log(`   🧹 Cleaned up ${cleanedCount} test folders`);
});

// ============================================================================
// TEST RUNNER
// ============================================================================

async function main() {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('🚀 Combined Authentication & Wallet Folders Test Suite');
  console.log('='.repeat(60));
  console.log('This will test the complete flow:');
  console.log('• ZK commitment and proof generation');
  console.log('• User authentication (signup & login)');
  console.log('• Wallet folders management');
  console.log('• Wallet operations (create, update, delete)');
  console.log('');
  console.log('🛠️  PROPER DELETE HANDLING:');
  console.log('• 60-second timeouts for vault operations');
  console.log('• Waits for vault deletion to complete');
  console.log('• Separate handling for wallets with/without fileId');
  console.log('');
  console.log(`Test User: ${TEST_USER.phoneNumber}`);
  console.log(`User ID: ${TEST_USER.userId}`);
  console.log('');
  
  rl.question(`Make sure your server is running on ${BASE_URL}\nPress Enter to start tests...`, () => {
    rl.close();
    
    tests.runAll().catch(error => {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    });
  });
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Tests interrupted by user');
  process.exit(0);
});

// Start the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}


export { tests };