/**
 * Test suite for the new 8-step signup flow endpoints
 * This file tests the separated PIN setup, PIN confirmation, biometric setup, and username setup endpoints
 */

const request = require('supertest');
const app = require('../src/app'); // Adjust path as needed

describe('New Signup Flow Endpoints', () => {
  let sessionId;
  let userId;
  const testPhoneNumber = '+1234567890';
  const testPin = '1234';
  const testUsername = 'testuser' + Date.now(); // Unique username for each test run

  describe('Step 4: PIN Setup', () => {
    it('should setup PIN successfully', async () => {
      const response = await request(app)
        .post('/api/auth/setup-pin')
        .send({
          phoneNumber: testPhoneNumber,
          pin: testPin
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBeDefined();
      expect(response.body.data.step).toBe('pin_setup');
      expect(response.body.data.nextStep).toBe('pin_confirmation');
      
      sessionId = response.body.data.sessionId;
    });

    it('should reject invalid PIN format', async () => {
      await request(app)
        .post('/api/auth/setup-pin')
        .send({
          phoneNumber: testPhoneNumber,
          pin: '123' // Too short
        })
        .expect(400);
    });

    it('should reject missing phone number', async () => {
      await request(app)
        .post('/api/auth/setup-pin')
        .send({
          pin: testPin
        })
        .expect(400);
    });
  });

  describe('Step 5: PIN Confirmation', () => {
    it('should confirm PIN successfully', async () => {
      const response = await request(app)
        .post('/api/auth/confirm-pin')
        .send({
          sessionId,
          pin: testPin
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.step).toBe('pin_confirmed');
      expect(response.body.data.nextStep).toBe('biometric_setup');
    });

    it('should reject wrong PIN', async () => {
      await request(app)
        .post('/api/auth/confirm-pin')
        .send({
          sessionId,
          pin: '9999' // Wrong PIN
        })
        .expect(400);
    });

    it('should reject invalid session', async () => {
      await request(app)
        .post('/api/auth/confirm-pin')
        .send({
          sessionId: 'invalid-session',
          pin: testPin
        })
        .expect(400);
    });
  });

  describe('Step 6: Biometric Setup', () => {
    it('should setup biometric successfully', async () => {
      const response = await request(app)
        .post('/api/auth/setup-biometric')
        .send({
          sessionId,
          biometricType: 'fingerprint',
          biometricData: 'base64_encoded_fingerprint_data'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.step).toBe('biometric_setup');
      expect(response.body.data.biometricType).toBe('fingerprint');
      expect(response.body.data.nextStep).toBe('did_creation');
    });

    it('should allow skipping biometric setup', async () => {
      // Create a new session for this test
      const pinSetupResponse = await request(app)
        .post('/api/auth/setup-pin')
        .send({
          phoneNumber: testPhoneNumber,
          pin: testPin
        });
      
      const newSessionId = pinSetupResponse.body.data.sessionId;
      
      // Confirm PIN
      await request(app)
        .post('/api/auth/confirm-pin')
        .send({
          sessionId: newSessionId,
          pin: testPin
        });

      // Skip biometric setup
      const response = await request(app)
        .post('/api/auth/setup-biometric')
        .send({
          sessionId: newSessionId
          // No biometric data provided
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.biometricType).toBeNull();
      expect(response.body.message).toContain('skipped');
    });

    it('should reject invalid biometric type', async () => {
      await request(app)
        .post('/api/auth/setup-biometric')
        .send({
          sessionId,
          biometricType: 'invalid_type',
          biometricData: 'some_data'
        })
        .expect(400);
    });

    it('should reject setup without PIN confirmation', async () => {
      // Create a new session without PIN confirmation
      const pinSetupResponse = await request(app)
        .post('/api/auth/setup-pin')
        .send({
          phoneNumber: testPhoneNumber,
          pin: testPin
        });
      
      const newSessionId = pinSetupResponse.body.data.sessionId;
      
      await request(app)
        .post('/api/auth/setup-biometric')
        .send({
          sessionId: newSessionId,
          biometricType: 'fingerprint'
        })
        .expect(400);
    });
  });

  describe('Step 7: Complete Signup', () => {
    it('should complete signup successfully', async () => {
      const response = await request(app)
        .post('/api/auth/complete-signup')
        .send({
          sessionId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBeDefined();
      expect(response.body.data.walletAddress).toBeDefined();
      expect(response.body.nextStep).toBe('username_setup');
      
      userId = response.body.data.userId;
    });

    it('should reject completion without biometric setup', async () => {
      // Create a new session without completing biometric setup
      const pinSetupResponse = await request(app)
        .post('/api/auth/setup-pin')
        .send({
          phoneNumber: testPhoneNumber,
          pin: testPin
        });
      
      const newSessionId = pinSetupResponse.body.data.sessionId;
      
      await request(app)
        .post('/api/auth/complete-signup')
        .send({
          sessionId: newSessionId
        })
        .expect(400);
    });
  });

  describe('Step 8: Username Setup', () => {
    it('should setup username successfully', async () => {
      const response = await request(app)
        .post('/api/auth/setup-username')
        .send({
          sessionId,
          username: testUsername,
          userId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe(testUsername);
      expect(response.body.data.completed).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.message).toContain('Welcome to K33P!');
    });

    it('should reject invalid username format', async () => {
      await request(app)
        .post('/api/auth/setup-username')
        .send({
          sessionId,
          username: 'ab', // Too short
          userId
        })
        .expect(400);
    });

    it('should reject username with invalid characters', async () => {
      await request(app)
        .post('/api/auth/setup-username')
        .send({
          sessionId,
          username: 'user@name', // Invalid character
          userId
        })
        .expect(400);
    });

    it('should reject duplicate username', async () => {
      await request(app)
        .post('/api/auth/setup-username')
        .send({
          sessionId,
          username: testUsername, // Same username as before
          userId
        })
        .expect(400);
    });

    it('should reject setup without completed signup', async () => {
      // Create a new session without completing signup
      const pinSetupResponse = await request(app)
        .post('/api/auth/setup-pin')
        .send({
          phoneNumber: testPhoneNumber,
          pin: testPin
        });
      
      const newSessionId = pinSetupResponse.body.data.sessionId;
      
      await request(app)
        .post('/api/auth/setup-username')
        .send({
          sessionId: newSessionId,
          username: 'newuser123'
        })
        .expect(400);
    });
  });

  describe('Session Status Helper', () => {
    it('should return session status', async () => {
      // Create a new session for this test
      const pinSetupResponse = await request(app)
        .post('/api/auth/setup-pin')
        .send({
          phoneNumber: testPhoneNumber,
          pin: testPin
        });
      
      const newSessionId = pinSetupResponse.body.data.sessionId;
      
      const response = await request(app)
        .get(`/api/auth/session-status/${newSessionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe(newSessionId);
      expect(response.body.data.step).toBe('pin_setup');
      expect(response.body.data.phoneNumber).toContain('*'); // Should be masked
      expect(response.body.data.timestamp).toBeDefined();
    });

    it('should return 404 for invalid session', async () => {
      await request(app)
        .get('/api/auth/session-status/invalid-session')
        .expect(404);
    });
  });

  describe('Complete Flow Integration', () => {
    it('should complete entire signup flow successfully', async () => {
      const uniqueUsername = 'fulltest' + Date.now();
      
      // Step 4: Setup PIN
      const pinSetupResponse = await request(app)
        .post('/api/auth/setup-pin')
        .send({
          phoneNumber: '+1987654321',
          pin: '5678'
        })
        .expect(200);
      
      const flowSessionId = pinSetupResponse.body.data.sessionId;
      
      // Step 5: Confirm PIN
      await request(app)
        .post('/api/auth/confirm-pin')
        .send({
          sessionId: flowSessionId,
          pin: '5678'
        })
        .expect(200);
      
      // Step 6: Setup Biometric
      await request(app)
        .post('/api/auth/setup-biometric')
        .send({
          sessionId: flowSessionId,
          biometricType: 'faceid',
          biometricData: 'base64_face_data'
        })
        .expect(200);
      
      // Step 7: Complete Signup
      const signupResponse = await request(app)
        .post('/api/auth/complete-signup')
        .send({
          sessionId: flowSessionId
        })
        .expect(200);
      
      const flowUserId = signupResponse.body.data.userId;
      
      // Step 8: Setup Username
      const usernameResponse = await request(app)
        .post('/api/auth/setup-username')
        .send({
          sessionId: flowSessionId,
          username: uniqueUsername,
          userId: flowUserId
        })
        .expect(200);
      
      expect(usernameResponse.body.success).toBe(true);
      expect(usernameResponse.body.data.completed).toBe(true);
      expect(usernameResponse.body.token).toBeDefined();
    });
  });
});

// Helper function to clean up test data (if needed)
after(async () => {
  // Clean up any test data if necessary
  console.log('Test cleanup completed');
});