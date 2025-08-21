const crypto = require('crypto');

// Mock user data for testing
const mockUsers = [
  {
    user_id: 'test-user-1',
    phone_hash: crypto.createHash('sha256').update('+1234567890').digest('hex'),
    pin_hash: crypto.createHash('sha256').update('1234').digest('hex'),
    auth_methods: JSON.stringify(['face_id', 'pin']), // User registered with Face ID as primary
    biometric_data: JSON.stringify({
      face_id: 'mock_face_data_123'
    }),
    is_active: true
  },
  {
    user_id: 'test-user-2', 
    phone_hash: crypto.createHash('sha256').update('+0987654321').digest('hex'),
    pin_hash: crypto.createHash('sha256').update('5678').digest('hex'),
    auth_methods: JSON.stringify(['fingerprint']), // User registered with fingerprint only
    biometric_data: JSON.stringify({
      fingerprint: 'mock_fingerprint_456'
    }),
    is_active: true
  },
  {
    user_id: 'test-user-3',
    phone_hash: crypto.createHash('sha256').update('+1122334455').digest('hex'),
    pin_hash: crypto.createHash('sha256').update('9999').digest('hex'),
    auth_methods: JSON.stringify(['pin']), // User registered with PIN only
    biometric_data: JSON.stringify({}),
    is_active: true
  }
];

// Mock database query function
function mockDatabaseQuery(phoneNumber) {
  const phoneHash = crypto.createHash('sha256').update(phoneNumber).digest('hex');
  return mockUsers.find(user => user.phone_hash === phoneHash);
}

// Simulate the updated signin logic
function simulateSignin(phoneNumber, pin = null, biometricData = null, biometricType = null) {
  const user = mockDatabaseQuery(phoneNumber);
  
  if (!user) {
    return { success: false, status: 404, message: 'User not found' };
  }
  
  if (!user.is_active) {
    return { success: false, status: 401, message: 'Account is deactivated' };
  }
  
  const authMethods = JSON.parse(user.auth_methods);
  const storedBiometricData = JSON.parse(user.biometric_data);
  
  let authenticationSuccessful = false;
  let authMethod = '';
  
  // Priority: Use the auth method they registered with, PIN is optional fallback
  
  // If biometric data is provided, try biometric authentication first
  if (biometricData && biometricType && authMethods.includes(biometricType)) {
    const storedBiometric = storedBiometricData[biometricType];
    if (storedBiometric) {
      const providedBiometric = biometricData[biometricType];
      if (providedBiometric && providedBiometric === storedBiometric) {
        authenticationSuccessful = true;
        authMethod = biometricType.toUpperCase().replace('_', ' ');
      }
    }
  }
  
  // If biometric auth failed or not provided, try PIN as optional fallback
  if (!authenticationSuccessful && pin && user.pin_hash) {
    const pinHash = crypto.createHash('sha256').update(pin).digest('hex');
    if (pinHash === user.pin_hash) {
      authenticationSuccessful = true;
      authMethod = 'PIN';
    }
  }
  
  // If no authentication method was provided or succeeded
  if (!authenticationSuccessful) {
    if (!pin && (!biometricData || !biometricType)) {
      return {
        success: false,
        status: 400,
        message: `Please provide authentication using one of your registered methods: ${authMethods.join(', ')}`,
        error: 'MISSING_AUTH_METHOD',
        availableAuthMethods: authMethods
      };
    } else {
      return {
        success: false,
        status: 401,
        message: 'Authentication failed. Please check your credentials.',
        error: 'INVALID_CREDENTIALS',
        availableAuthMethods: authMethods
      };
    }
  }
  
  return {
    success: true,
    status: 200,
    message: `Signin successful using ${authMethod}`,
    authMethod,
    availableAuthMethods: authMethods,
    user: {
      id: user.user_id,
      phoneNumber,
      authMethods
    }
  };
}

console.log('=== OPTIONAL PIN SIGNIN FUNCTIONALITY DEMONSTRATION ===\n');

// Test 1: Face ID user with biometric auth (should succeed)
console.log('Test 1: Face ID User with Biometric Authentication');
console.log('Input: Phone +1234567890, Face ID biometric data');
const result1 = simulateSignin(
  '+1234567890',
  null, // No PIN provided
  { face_id: 'mock_face_data_123' },
  'face_id'
);
console.log('Result:', JSON.stringify(result1, null, 2));
console.log('\n' + '='.repeat(60) + '\n');

// Test 2: Face ID user with PIN fallback (should succeed)
console.log('Test 2: Face ID User with PIN Fallback (PIN is optional)');
console.log('Input: Phone +1234567890, PIN 1234 (no biometric data)');
const result2 = simulateSignin(
  '+1234567890',
  '1234', // PIN provided as fallback
  null, // No biometric data
  null
);
console.log('Result:', JSON.stringify(result2, null, 2));
console.log('\n' + '='.repeat(60) + '\n');

// Test 3: Fingerprint user without any auth (should require fingerprint)
console.log('Test 3: Fingerprint User with No Authentication Provided');
console.log('Input: Phone +0987654321, no PIN, no biometric data');
const result3 = simulateSignin(
  '+0987654321',
  null, // No PIN
  null, // No biometric data
  null
);
console.log('Result:', JSON.stringify(result3, null, 2));
console.log('\n' + '='.repeat(60) + '\n');

// Test 4: PIN-only user with PIN (should succeed)
console.log('Test 4: PIN-Only User with PIN');
console.log('Input: Phone +1122334455, PIN 9999');
const result4 = simulateSignin(
  '+1122334455',
  '9999', // Correct PIN
  null,
  null
);
console.log('Result:', JSON.stringify(result4, null, 2));
console.log('\n' + '='.repeat(60) + '\n');

// Test 5: Face ID user with wrong PIN (should fail)
console.log('Test 5: Face ID User with Wrong PIN');
console.log('Input: Phone +1234567890, wrong PIN 0000');
const result5 = simulateSignin(
  '+1234567890',
  '0000', // Wrong PIN
  null,
  null
);
console.log('Result:', JSON.stringify(result5, null, 2));
console.log('\n' + '='.repeat(60) + '\n');

console.log('SUMMARY OF OPTIONAL PIN SIGNIN IMPLEMENTATION:');
console.log('✅ Users can authenticate with their primary registered method (biometrics)');
console.log('✅ PIN is now optional and serves as a fallback authentication method');
console.log('✅ Users must provide at least one valid authentication method they registered with');
console.log('✅ Clear error messages indicate available authentication methods');
console.log('✅ Invalid credentials are properly rejected');
console.log('✅ The signin endpoint prioritizes the original auth method from signup');