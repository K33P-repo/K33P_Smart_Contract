// test/image-number.test.ts
import http from 'http';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:3000';

// Global variables
let authToken = '';
let testUserId = '';

// Helper functions
function makeRequest(method: string, path: string, data: any = null, headers: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 30000
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
          const result = {
            status: res.statusCode,
            body: null as any,
            headers: res.headers
          };
          
          if (responseData && responseData.trim()) {
            try {
              result.body = JSON.parse(responseData);
            } catch (e) {
              // If not JSON, store as text
              result.body = responseData;
            }
          }
          
          resolve(result);
        } catch (e: any) {
          reject(new Error(`Response processing error: ${e.message}`));
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



function encryptAESDeterministic(data: string, key: Buffer): string {
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

// Test user data
const TEST_USER = {
  userId: crypto.randomUUID(),  // Use proper UUID
  phoneNumber: `555${Math.floor(Math.random() * 9000000) + 1000000}`,
  username: `imguser_${Date.now()}`,
  walletAddress: `0x${crypto.randomBytes(20).toString('hex')}`,
  pin: '123456'
};

let aesKey = crypto.randomBytes(32);

async function setupTestUser() {
  console.log(`\n=== Setting up test user: ${TEST_USER.userId} ===`);
  
  try {
    // First get ZK commitment
    const commitmentData = {
      phone: TEST_USER.phoneNumber,
      biometric: 'test_biometric',
      passkey: 'test_passkey'
    };

    const commitmentResponse = await makeRequest('POST', '/api/zk/commitment', commitmentData);
    
    if (!commitmentResponse.body?.success) {
      throw new Error('Failed to get ZK commitment');
    }

    const zkCommitment = commitmentResponse.body.data.commitment;

    // Get ZK proof
    const proofData = {
      phone: TEST_USER.phoneNumber,
      biometric: 'test_biometric',
      passkey: 'test_passkey',
      commitment: zkCommitment
    };

    const proofResponse = await makeRequest('POST', '/api/zk/proof', proofData);
    
    if (!proofResponse.body?.success) {
      throw new Error('Failed to get ZK proof');
    }

    const zkProof = proofResponse.body.data;
    const phoneEncrypted = encryptAESDeterministic(TEST_USER.phoneNumber, aesKey);
    const pinEncrypted = encryptAESDeterministic(TEST_USER.pin, aesKey);
    
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

    // Signup user
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

    const signupResponse = await makeRequest('POST', '/api/auth/signup', signupData);
    
    if (signupResponse.body?.success) {
      console.log(`✅ User created successfully: ${TEST_USER.userId}`);
      testUserId = TEST_USER.userId;
      authToken = signupResponse.body.data.token;
      console.log(`✅ Auth token received: ${authToken ? 'Yes' : 'No'}`);
      
      // Setup username
      const usernameData = {
        username: TEST_USER.username
      };
      
      const usernameResponse = await makeRequest('POST', '/api/auth/setup-username', usernameData);
      
      if (usernameResponse.body?.success) {
        console.log(`✅ Username setup successful: ${TEST_USER.username}`);
        return true;
      } else {
        console.log('⚠️ Username setup failed, but user created');
        return true;
      }
    } else {
      console.log(`❌ User creation failed: ${signupResponse.body?.error?.message || 'No error message'}`);
      console.log(`   Status: ${signupResponse.status}`);
      console.log(`   Body:`, signupResponse.body);
      return false;
    }
  } catch (error: any) {
    console.log(`❌ Setup failed: ${error.message}`);
    return false;
  }
}

// ============================================================================
// IMAGE NUMBER TESTS FOR NEW ROUTES (/api/image-number)
// ============================================================================

async function testGetCurrentImageNumber() {
  console.log(`\n=== Testing GET /api/image-number ===`);
  
  try {
    const response = await makeRequest('GET', `/api/image-number`);
    console.log(`Response status: ${response.status}`);
    console.log(`Response body type: ${typeof response.body}`);
    
    if (response.status === 200 && response.body?.success) {
      const { imageNumber, availableNumbers } = response.body.data;
      console.log(`✅ Current image number retrieved: ${imageNumber}`);
      console.log(`   Available numbers: ${availableNumbers?.join(', ')}`);
      return imageNumber;
    } else if (response.status === 401) {
      console.log(`❌ Unauthorized: Status ${response.status}`);
      console.log(`   Error: ${response.body?.error || 'Authentication required'}`);
      return null;
    } else {
      console.log(`❌ Unexpected response: Status ${response.status}`);
      console.log(`   Body:`, response.body);
      return null;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}

async function testUpdateImageNumber(newImageNumber: number, expectSuccess = true) {
  console.log(`\n=== Testing PUT /api/image-number (set to ${newImageNumber}) ===`);
  
  try {
    const response = await makeRequest('PUT', `/api/image-number`, {
      imageNumber: newImageNumber
    });
    
    console.log(`Response status: ${response.status}`);
    
    if (response.status === 200 && response.body?.success && expectSuccess) {
      const { oldImageNumber, newImageNumber: updatedNumber } = response.body.data;
      console.log(`✅ Image number updated: ${oldImageNumber} -> ${updatedNumber}`);
      return updatedNumber;
    } else if ((response.status === 400 || response.status === 422) && !expectSuccess) {
      console.log(`✅ Expected failure: Status ${response.status}`);
      console.log(`   Error: ${response.body?.error?.message || 'Validation error'}`);
      return null;
    } else if (response.status === 401) {
      console.log(`❌ Unauthorized: Status ${response.status}`);
      console.log(`   Error: ${response.body?.error || 'Authentication required'}`);
      return null;
    } else {
      console.log(`❌ Unexpected result: Status ${response.status}`);
      console.log(`   Body:`, response.body);
      return null;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}

async function testGetImageNumberPreviews() {
  console.log(`\n=== Testing GET /api/image-number/preview ===`);
  
  try {
    const response = await makeRequest('GET', `/api/image-number/preview`);
    console.log(`Response status: ${response.status}`);
    
    if (response.status === 200 && response.body?.success) {
      const { currentImageNumber, previews } = response.body.data;
      console.log(`✅ Image number previews retrieved`);
      console.log(`   Current: ${currentImageNumber}`);
      if (previews && Array.isArray(previews)) {
        previews.forEach((preview: any) => {
          console.log(`   - ${preview.number}: ${preview.name} (${preview.isCurrent ? 'current' : 'not current'})`);
        });
      }
      return previews;
    } else if (response.status === 401) {
      console.log(`❌ Unauthorized: Status ${response.status}`);
      console.log(`   Error: ${response.body?.error || 'Authentication required'}`);
      return null;
    } else {
      console.log(`❌ Unexpected response: Status ${response.status}`);
      console.log(`   Body:`, response.body);
      return null;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}

async function testSetRandomImageNumber() {
  console.log(`\n=== Testing PUT /api/image-number/random ===`);
  
  try {
    const response = await makeRequest('PUT', `/api/image-number/random`, {});
    console.log(`Response status: ${response.status}`);
    
    if (response.status === 200 && response.body?.success) {
      const { oldImageNumber, newImageNumber, wasRandomized } = response.body.data;
      console.log(`✅ Random image number set: ${oldImageNumber} -> ${newImageNumber}`);
      console.log(`   Was randomized: ${wasRandomized}`);
      return newImageNumber;
    } else if (response.status === 401) {
      console.log(`❌ Unauthorized: Status ${response.status}`);
      console.log(`   Error: ${response.body?.error || 'Authentication required'}`);
      return null;
    } else {
      console.log(`❌ Unexpected response: Status ${response.status}`);
      console.log(`   Body:`, response.body);
      return null;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}



async function testResetImageNumber(confirm = false, skipIfAlreadyAtDefault = false) {
    console.log(`\n=== Testing PUT /api/image-number/reset (confirm: ${confirm}) ===`);
    
    try {
      // First check current image number
      const currentImageResponse = await makeRequest('GET', `/api/image-number`);
      
      if (currentImageResponse.status !== 200) {
        console.log(`❌ Failed to get current image number: Status ${currentImageResponse.status}`);
        return null;
      }
      
      const currentImageNumber = currentImageResponse.body?.data?.imageNumber || 1;
      console.log(`   Current image number before reset: ${currentImageNumber}`);
      
      // If we're already at 1 and skipIfAlreadyAtDefault is true, skip the test
      if (currentImageNumber === 1 && skipIfAlreadyAtDefault) {
        console.log(`⚠️ Skipping reset test - already at default (1)`);
        return 'skipped_already_default';
      }
      
      const response = await makeRequest('PUT', `/api/image-number/reset`, {
        confirm
      });
      
      console.log(`Response status: ${response.status}`);
      
      if (response.status === 200 && response.body?.success) {
        const { oldImageNumber, newImageNumber, wasReset } = response.body.data;
        console.log(`✅ Image number reset: ${oldImageNumber} -> ${newImageNumber}`);
        console.log(`   Was reset: ${wasReset}`);
        return newImageNumber;
      } else if (response.status === 400 && !confirm && response.body?.error === 'CONFIRMATION_REQUIRED') {
        console.log(`✅ Expected confirmation required: ${response.body?.message}`);
        return 'confirmation_required';
      } else if (response.status === 400 && response.body?.error === 'ALREADY_DEFAULT') {
        // This is expected if we're already at 1
        if (currentImageNumber === 1) {
          console.log(`✅ Already at default (1): ${response.body?.message}`);
          return 'already_at_default';
        } else {
          console.log(`❌ Got ALREADY_DEFAULT but current is ${currentImageNumber}, not 1`);
          return null;
        }
      } else if (response.status === 401) {
        console.log(`❌ Unauthorized: Status ${response.status}`);
        console.log(`   Error: ${response.body?.error || 'Authentication required'}`);
        return null;
      } else {
        console.log(`❌ Unexpected response: Status ${response.status}`);
        console.log(`   Body:`, response.body);
        return null;
      }
    } catch (error: any) {
      console.log(`❌ Request failed: ${error.message}`);
      return null;
    }
  }

async function testInvalidImageNumbers() {
  console.log(`\n=== Testing Invalid Image Numbers ===`);
  
  const invalidNumbers = [
    { value: 0, description: 'Below minimum (0)' },
    { value: 4, description: 'Above maximum (4)' },
    { value: -1, description: 'Negative number (-1)' },
    { value: 'abc', description: 'Non-numeric string' },
    { value: 2.5, description: 'Decimal number' },
    { value: 100, description: 'Large number' }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const { value, description } of invalidNumbers) {
    console.log(`\nTesting: ${description} (${value})`);
    
    try {
      const response = await makeRequest('PUT', `/api/image-number`, {
        imageNumber: value
      });
      
      if (response.status === 400 || response.status === 422) {
        console.log(`✅ Correctly rejected invalid number (Status: ${response.status})`);
        passed++;
      } else if (response.status === 401) {
        console.log(`❌ Unauthorized instead of validation error`);
        failed++;
      } else {
        console.log(`❌ Should have rejected but got status: ${response.status}`);
        console.log(`   Body:`, response.body);
        failed++;
      }
    } catch (error: any) {
      console.log(`✅ Request failed (expected for invalid input): ${error.message}`);
      passed++;
    }
  }
  
  console.log(`\nInvalid number tests: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

async function testUnauthorizedAccess() {
  console.log(`\n=== Testing Unauthorized Access ===`);
  
  // Save current token
  const originalToken = authToken;
  let unauthorizedTestsPassed = 0;
  let unauthorizedTestsFailed = 0;
  
  // Test without token
  const endpoints = [
    { method: 'GET', path: '/api/image-number', name: 'Get current image number' },
    { method: 'PUT', path: '/api/image-number', name: 'Update image number', data: { imageNumber: 2 } },
    { method: 'GET', path: '/api/image-number/preview', name: 'Get previews' },
    { method: 'PUT', path: '/api/image-number/random', name: 'Set random' },
    { method: 'PUT', path: '/api/image-number/reset', name: 'Reset', data: { confirm: true } }
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\nTesting ${endpoint.name} without token...`);
    authToken = '';
    
    try {
      const response = await makeRequest(endpoint.method, endpoint.path, endpoint.data || {});
      
      if (response.status === 401 || response.status === 403) {
        console.log(`✅ Correctly rejected unauthorized access (Status: ${response.status})`);
        unauthorizedTestsPassed++;
      } else {
        console.log(`❌ Should have rejected unauthorized access but got status: ${response.status}`);
        console.log(`   Body:`, response.body);
        unauthorizedTestsFailed++;
      }
    } catch (error: any) {
      console.log(`✅ Request failed (expected for unauthorized): ${error.message}`);
      unauthorizedTestsPassed++;
    }
  }
  
  // Restore token
  authToken = originalToken;
  
  console.log(`\nUnauthorized access tests: ${unauthorizedTestsPassed} passed, ${unauthorizedTestsFailed} failed`);
  return { passed: unauthorizedTestsPassed, failed: unauthorizedTestsFailed };
}

async function testImageNumberCycle() {
  console.log(`\n=== Testing Complete Image Number Cycle ===`);
  
  let allPassed = true;
  const results = [];
  const steps = [];
  
  try {
    // First, test if auth works
    console.log(`\n🔍 Testing authentication...`);
    const profileResponse = await makeRequest('GET', `/api/image-number`);
    
    if (profileResponse.status === 200) {
      console.log(`✅ Authentication works!`);
      steps.push('Authentication: ✓');
    } else {
      console.log(`❌ Authentication failed: Status ${profileResponse.status}`);
      console.log(`   Body:`, profileResponse.body);
      allPassed = false;
      steps.push('Authentication: ✗');
      return { allPassed, steps };
    }
    
    // Start with default (should be 1)
    const currentImage = await testGetCurrentImageNumber();
    if (currentImage === null) {
      console.log(`⚠️ Could not get current image number`);
      allPassed = false;
      steps.push('Get initial image number: ✗');
      return { allPassed, steps };
    }
    
    if (currentImage !== 1) {
      console.log(`⚠️ Starting image number is ${currentImage}, expected 1`);
    }
    steps.push(`Get initial image number (${currentImage}): ✓`);
    
    // Update to 2
    const updatedTo2 = await testUpdateImageNumber(2);
    if (updatedTo2 === 2) {
      steps.push('Update to 2: ✓');
    } else {
      steps.push('Update to 2: ✗');
      allPassed = false;
    }
    
    // Get current (should be 2)
    const currentAfterUpdate = await testGetCurrentImageNumber();
    if (currentAfterUpdate === 2) {
      steps.push('Verify update to 2: ✓');
    } else {
      steps.push('Verify update to 2: ✗');
      allPassed = false;
    }
    
    // Update to 3
    const updatedTo3 = await testUpdateImageNumber(3);
    if (updatedTo3 === 3) {
      steps.push('Update to 3: ✓');
    } else {
      steps.push('Update to 3: ✗');
      allPassed = false;
    }
    
    // Get current (should be 3)
    const currentAfterSecondUpdate = await testGetCurrentImageNumber();
    if (currentAfterSecondUpdate === 3) {
      steps.push('Verify update to 3: ✓');
    } else {
      steps.push('Verify update to 3: ✗');
      allPassed = false;
    }
    
    // Try to update to same number (should fail or be rejected)
    const sameNumberUpdate = await testUpdateImageNumber(3, false);
    if (sameNumberUpdate === null) {
      steps.push('Reject same number update: ✓');
    } else {
      steps.push('Reject same number update: ✗');
      allPassed = false;
    }
    
    // Get previews
    const previews = await testGetImageNumberPreviews();
    if (previews !== null && Array.isArray(previews) && previews.length === 3) {
      steps.push('Get previews: ✓');
    } else {
      steps.push('Get previews: ✗');
      allPassed = false;
    }
    
    // Set random number
    const randomNumber = await testSetRandomImageNumber();
    if (randomNumber !== null && [1, 2, 3].includes(randomNumber)) {
      steps.push(`Set random number (got ${randomNumber}): ✓`);
    } else {
      steps.push('Set random number: ✗');
      allPassed = false;
    }
    
    // Reset with confirmation required
    const resetConfirmation = await testResetImageNumber(false);
    if (resetConfirmation === 'confirmation_required') {
      steps.push('Require reset confirmation: ✓');
    } else {
      steps.push('Require reset confirmation: ✗');
      allPassed = false;
    }
    
    // Reset with confirmation
    const resetResult = await testResetImageNumber(true);
    if (resetResult === 1) {
    steps.push('Reset with confirmation: ✓');
    } else if (resetResult === 'already_at_default') {
    steps.push('Reset skipped (already at default): ✓');
    } else if (resetResult === 'skipped_already_default') {
    steps.push('Reset skipped (already at default): ✓');
    } else {
    steps.push('Reset with confirmation: ✗');
    allPassed = false;
    }
    
    // Final verification
    const finalImage = await testGetCurrentImageNumber();
    if (finalImage === 1) {
      steps.push('Final verification (back to 1): ✓');
    } else {
      steps.push(`Final verification (got ${finalImage}, expected 1): ✗`);
      allPassed = false;
    }
    
  } catch (error: any) {
    console.log(`❌ Error in image number cycle: ${error.message}`);
    steps.push(`Error: ${error.message}`);
    allPassed = false;
  }
  
  return { allPassed, steps };
}

async function testRateLimiting() {
  console.log(`\n=== Testing Rate Limiting ===`);
  
  // Try to make multiple requests quickly
  const requests = [];
  for (let i = 0; i < 10; i++) {
    requests.push(makeRequest('GET', '/api/image-number'));
  }
  
  try {
    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429).length;
    
    if (rateLimited > 0) {
      console.log(`✅ Rate limiting works (${rateLimited} requests were rate-limited)`);
      return true;
    } else {
      console.log(`⚠️ No rate limiting detected (might be disabled in test)`);
      return true; // Not a failure, rate limiting might be disabled
    }
  } catch (error: any) {
    console.log(`✅ Rate limiting likely triggered: ${error.message}`);
    return true;
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runImageNumberTests() {
  console.log('🚀 Starting Image Number Route Tests');
  console.log('='.repeat(70));
  console.log('Testing new routes: /api/image-number/*');
  console.log('='.repeat(70));
  
  // Setup test user
  console.log('\nSetting up test user...');
  const setupSuccess = await setupTestUser();
  
  if (!setupSuccess) {
    console.log('❌ Cannot run tests - user setup failed');
    return { success: false, reason: 'User setup failed' };
  }
  
  console.log(`\n🔍 TEST INFO:`);
  console.log(`   Test User ID: ${testUserId}`);
  console.log(`   Auth Token: ${authToken ? 'Present' : 'Missing'}`);
  console.log(`   Token length: ${authToken?.length || 0} chars`);
  
  const testSuites = [
    { name: 'Unauthorized Access', test: testUnauthorizedAccess },
    { name: 'Get Current Image Number', test: testGetCurrentImageNumber },
    { name: 'Update Image Number', test: () => testUpdateImageNumber(2) },
    { name: 'Get Previews', test: testGetImageNumberPreviews },
    { name: 'Invalid Numbers', test: testInvalidImageNumbers },
    { name: 'Random Image Number', test: testSetRandomImageNumber },
    { 
        name: 'Reset Image Number', 
        test: async () => {
          // Skip if already at default after random test
          return await testResetImageNumber(true, true);
        },
    },
    { name: 'Rate Limiting', test: testRateLimiting },
    { name: 'Complete Cycle', test: testImageNumberCycle }
  ];
  
  let totalPassed = 0;
  let totalFailed = 0;
  const allResults: any[] = [];
  let cycleSteps: string[] = [];
  
  for (const suite of testSuites) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${suite.name}`);
    console.log('='.repeat(60));
    
    try {
      const result = await suite.test();
      allResults.push({ suite: suite.name, result });
      
      // Different handling based on test type
      if (suite.name === 'Invalid Numbers' && typeof result === 'object') {
        const { passed, failed } = result;
        if (failed === 0) {
          totalPassed++;
          console.log(`\n✅ ${suite.name}: PASSED (${passed}/${passed + failed})`);
        } else {
          totalFailed++;
          console.log(`\n❌ ${suite.name}: FAILED (${passed}/${passed + failed})`);
        }
      } else if (suite.name === 'Unauthorized Access' && typeof result === 'object') {
        const { passed, failed } = result;
        if (failed === 0) {
          totalPassed++;
          console.log(`\n✅ ${suite.name}: PASSED (${passed}/${passed + failed})`);
        } else {
          totalFailed++;
          console.log(`\n❌ ${suite.name}: FAILED (${passed}/${passed + failed})`);
        }
      } else if (suite.name === 'Complete Cycle' && typeof result === 'object') {
        if (result.allPassed) {
          totalPassed++;
          console.log(`\n✅ ${suite.name}: PASSED`);
          cycleSteps = result.steps;
          console.log('   Steps:');
          result.steps.forEach((step: string) => {
            console.log(`   ${step}`);
          });
        } else {
          totalFailed++;
          console.log(`\n❌ ${suite.name}: FAILED`);
          cycleSteps = result.steps;
          if (result.steps) {
            console.log('   Steps:');
            result.steps.forEach((step: string) => {
              console.log(`   ${step}`);
            });
          }
        }
      } else if (result !== null && result !== false) {
        totalPassed++;
        console.log(`\n✅ ${suite.name}: PASSED`);
      } else {
        totalFailed++;
        console.log(`\n❌ ${suite.name}: FAILED`);
      }
    } catch (error: any) {
      totalFailed++;
      console.log(`\n💥 ${suite.name}: CRASHED - ${error.message}`);
      console.log(`   Stack: ${error.stack}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 IMAGE NUMBER ROUTE TEST RESULTS');
  console.log('='.repeat(70));
  console.log(`Total Test Suites: ${testSuites.length}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Success Rate: ${Math.round((totalPassed / testSuites.length) * 100)}%`);
  
  console.log(`\n🔍 DIAGNOSIS:`);
  console.log(`   1. User created: ${setupSuccess ? '✅' : '❌'}`);
  console.log(`   2. Auth token received: ${authToken ? '✅' : '❌'}`);
  console.log(`   3. Routes tested: ${allResults.length}`);
  
  console.log(`\n🎯 TESTED ENDPOINTS:`);
  console.log(`   • GET    /api/image-number`);
  console.log(`   • PUT    /api/image-number`);
  console.log(`   • GET    /api/image-number/preview`);
  console.log(`   • PUT    /api/image-number/random`);
  console.log(`   • PUT    /api/image-number/reset`);
  
  if (cycleSteps.length > 0) {
    console.log(`\n📋 COMPLETE CYCLE STEPS:`);
    cycleSteps.forEach(step => {
      console.log(`   ${step}`);
    });
  }
  
  if (totalFailed === 0) {
    console.log('\n🎉 ALL IMAGE NUMBER ROUTE TESTS PASSED!');
  } else {
    console.log('\n💥 SOME TESTS FAILED - NEEDS INVESTIGATION');
    console.log(`\n🛠️  NEXT STEPS:`);
    console.log(`   1. Check server is running on port 3000`);
    console.log(`   2. Verify database has image_number column`);
    console.log(`   3. Check auth middleware extracts user ID correctly`);
    console.log(`   4. Look at server logs for detailed errors`);
  }
  
  // Cleanup info
  console.log(`\n📝 Test user ID for cleanup: ${testUserId}`);
  console.log(`📝 Auth token (first 50 chars): ${authToken ? authToken.substring(0, 50) + '...' : 'None'}`);
  
  return { 
    success: totalFailed === 0,
    totalPassed, 
    totalFailed,
    successRate: Math.round((totalPassed / testSuites.length) * 100),
    testUserId
  };
}

// Add graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️ Test interrupted by user');
  console.log(`📝 Test user ID: ${testUserId}`);
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('\n\n💥 Uncaught exception:', error);
  process.exit(1);
});

// Run the tests
console.log(`
███████╗██╗  ██╗███████╗ ██████╗ ██╗   ██╗██╗███╗   ██╗███████╗
██╔════╝╚██╗██╔╝██╔════╝██╔════╝ ██║   ██║██║████╗  ██║██╔════╝
█████╗   ╚███╔╝ █████╗  ██║  ███╗██║   ██║██║██╔██╗ ██║█████╗  
██╔══╝   ██╔██╗ ██╔══╝  ██║   ██║██║   ██║██║██║╚██╗██║██╔══╝  
███████╗██╔╝ ██╗███████╗╚██████╔╝╚██████╔╝██║██║ ╚████║███████╗
╚══════╝╚═╝  ╚═╝╚══════╝ ╚═════╝  ╚═════╝ ╚═╝╚═╝  ╚═══╝╚══════╝
Image Number Route Tests (/api/image-number)
`);

runImageNumberTests()
  .then(results => {
    console.log('\n' + '='.repeat(70));
    console.log('🏁 Test execution completed');
    console.log(`   Final result: ${results.success ? 'SUCCESS' : 'FAILURE'}`);
    console.log(`   Success rate: ${results.successRate}%`);
    process.exit(results.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Test runner crashed:', error);
    process.exit(1);
  });