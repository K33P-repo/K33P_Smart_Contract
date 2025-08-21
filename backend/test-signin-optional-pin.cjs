const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

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

// Test endpoint 1: Face ID user with biometric auth (should succeed)
app.post('/test-faceid-user-biometric', (req, res) => {
  console.log('\n=== Testing Face ID User with Biometric Auth ===');
  const result = simulateSignin(
    '+1234567890',
    null, // No PIN provided
    { face_id: 'mock_face_data_123' },
    'face_id'
  );
  console.log('Result:', result);
  return res.status(result.status).json(result);
});

// Test endpoint 2: Face ID user with PIN fallback (should succeed)
app.post('/test-faceid-user-pin-fallback', (req, res) => {
  console.log('\n=== Testing Face ID User with PIN Fallback ===');
  const result = simulateSignin(
    '+1234567890',
    '1234', // PIN provided as fallback
    null, // No biometric data
    null
  );
  console.log('Result:', result);
  return res.status(result.status).json(result);
});

// Test endpoint 3: Fingerprint user without any auth (should require fingerprint)
app.post('/test-fingerprint-user-no-auth', (req, res) => {
  console.log('\n=== Testing Fingerprint User with No Auth Provided ===');
  const result = simulateSignin(
    '+0987654321',
    null, // No PIN
    null, // No biometric data
    null
  );
  console.log('Result:', result);
  return res.status(result.status).json(result);
});

// Test endpoint 4: PIN-only user with PIN (should succeed)
app.post('/test-pin-user-with-pin', (req, res) => {
  console.log('\n=== Testing PIN-Only User with PIN ===');
  const result = simulateSignin(
    '+1122334455',
    '9999', // Correct PIN
    null,
    null
  );
  console.log('Result:', result);
  return res.status(result.status).json(result);
});

// Test endpoint 5: Face ID user with wrong PIN (should fail)
app.post('/test-faceid-user-wrong-pin', (req, res) => {
  console.log('\n=== Testing Face ID User with Wrong PIN ===');
  const result = simulateSignin(
    '+1234567890',
    '0000', // Wrong PIN
    null,
    null
  );
  console.log('Result:', result);
  return res.status(result.status).json(result);
});

const PORT = 9876;
app.listen(PORT, () => {
  console.log(`Optional PIN signin test server running on port ${PORT}`);
  console.log('\nTest scenarios:');
  console.log(`- POST http://localhost:${PORT}/test-faceid-user-biometric`);
  console.log(`- POST http://localhost:${PORT}/test-faceid-user-pin-fallback`);
  console.log(`- POST http://localhost:${PORT}/test-fingerprint-user-no-auth`);
  console.log(`- POST http://localhost:${PORT}/test-pin-user-with-pin`);
  console.log(`- POST http://localhost:${PORT}/test-faceid-user-wrong-pin`);
  console.log('\nThese tests demonstrate:');
  console.log('1. Users can use their primary auth method (biometrics)');
  console.log('2. PIN is optional fallback for users who have it');
  console.log('3. Users must provide auth method they registered with');
  console.log('4. Clear error messages show available auth methods');
  console.log('5. Wrong credentials are properly rejected');
});