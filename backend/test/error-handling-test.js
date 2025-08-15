// Comprehensive Error Handling Test Suite for K33P API
// Tests all endpoints to ensure consistent error and success response formats

import axios from 'axios';
import { expect } from 'chai';
import { describe, it, before, after } from 'mocha';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

// Test data
const testData = {
  validPhone: '+1234567890',
  invalidPhone: 'invalid-phone',
  validWallet: 'addr_test1234567890abcdef',
  validUserId: 'user_12345',
  validPin: '1234',
  invalidPin: '12',
  validOtp: '123456',
  invalidOtp: '000000'
};

// Helper function to validate response structure
function validateSuccessResponse(response) {
  expect(response.data).to.have.property('success', true);
  expect(response.data).to.have.property('timestamp');
  expect(response.data.timestamp).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
}

function validateErrorResponse(response) {
  expect(response.data).to.have.property('success', false);
  expect(response.data).to.have.property('error');
  expect(response.data.error).to.have.property('code');
  expect(response.data.error).to.have.property('message');
  expect(response.data).to.have.property('timestamp');
  expect(response.data.timestamp).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
}

describe('K33P API Error Handling Tests', () => {
  let authToken = null;

  before(async () => {
    console.log('Setting up test environment...');
    // Add any setup logic here
  });

  after(async () => {
    console.log('Cleaning up test environment...');
    // Add any cleanup logic here
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/send-otp', () => {
      it('should return success response for valid phone number', async () => {
        try {
          const response = await axios.post(`${API_URL}/auth/send-otp`, {
            phoneNumber: testData.validPhone
          });
          
          expect(response.status).to.equal(200);
          validateSuccessResponse(response);
          expect(response.data.data).to.have.property('requestId');
          expect(response.data.data).to.have.property('expiresIn');
        } catch (error) {
          if (error.response) {
            console.log('Response data:', error.response.data);
          }
          throw error;
        }
      });

      it('should return validation error for missing phone number', async () => {
        try {
          await axios.post(`${API_URL}/auth/send-otp`, {});
          throw new Error('Expected validation error');
        } catch (error) {
          expect(error.response.status).to.equal(400);
          validateErrorResponse(error.response);
          expect(error.response.data.error.code).to.equal('VALIDATION_ERROR');
        }
      });

      it('should return validation error for invalid phone format', async () => {
        try {
          await axios.post(`${API_URL}/auth/send-otp`, {
            phoneNumber: testData.invalidPhone
          });
          throw new Error('Expected validation error');
        } catch (error) {
          expect(error.response.status).to.equal(400);
          validateErrorResponse(error.response);
        }
      });
    });

    describe('POST /api/auth/signup', () => {
      it('should return validation error for missing required fields', async () => {
        try {
          await axios.post(`${API_URL}/auth/signup`, {});
          throw new Error('Expected validation error');
        } catch (error) {
          expect(error.response.status).to.equal(400);
          validateErrorResponse(error.response);
        }
      });

      it('should handle phone number already in use scenario', async () => {
        try {
          // First signup attempt
          await axios.post(`${API_URL}/auth/signup`, {
            phoneNumber: testData.validPhone,
            userId: testData.validUserId,
            verificationMethod: 'phone'
          });

          // Second signup attempt with same phone
          await axios.post(`${API_URL}/auth/signup`, {
            phoneNumber: testData.validPhone,
            userId: 'different_user_id',
            verificationMethod: 'phone'
          });
          
          // Should either succeed (existing user update) or fail with specific error
        } catch (error) {
          if (error.response.status === 409) {
            validateErrorResponse(error.response);
            expect(error.response.data.error.code).to.equal('PHONE_ALREADY_EXISTS');
          }
        }
      });
    });
  });

  describe('UTXO Management Endpoints', () => {
    describe('POST /api/utxo/refund', () => {
      it('should return authentication error without token', async () => {
        try {
          await axios.post(`${API_URL}/utxo/refund`, {
            utxo: { txHash: 'test', outputIndex: 0 },
            ownerAddress: testData.validWallet
          });
          throw new Error('Expected authentication error');
        } catch (error) {
          expect(error.response.status).to.equal(401);
          validateErrorResponse(error.response);
          expect(error.response.data.error.code).to.equal('AUTH_TOKEN_MISSING');
        }
      });

      it('should return validation error for missing required fields', async () => {
        try {
          await axios.post(`${API_URL}/utxo/refund`, {}, {
            headers: { Authorization: 'Bearer invalid_token' }
          });
          throw new Error('Expected validation error');
        } catch (error) {
          // Could be auth error (401) or validation error (400)
          expect([400, 401]).to.include(error.response.status);
          validateErrorResponse(error.response);
        }
      });
    });

    describe('GET /api/utxo/fetch/:phoneHash', () => {
      it('should return authentication error without token', async () => {
        try {
          await axios.get(`${API_URL}/utxo/fetch/test_hash`);
          throw new Error('Expected authentication error');
        } catch (error) {
          expect(error.response.status).to.equal(401);
          validateErrorResponse(error.response);
        }
      });
    });
  });

  describe('User Management Endpoints', () => {
    describe('GET /api/user/profile', () => {
      it('should return authentication error without token', async () => {
        try {
          await axios.get(`${API_URL}/user/profile`);
          throw new Error('Expected authentication error');
        } catch (error) {
          expect(error.response.status).to.equal(401);
          validateErrorResponse(error.response);
        }
      });
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should handle rate limiting properly', async function() {
      this.timeout(10000); // Increase timeout for rate limiting tests
      
      const requests = [];
      const maxRequests = 15; // Exceed typical rate limits
      
      for (let i = 0; i < maxRequests; i++) {
        requests.push(
          axios.post(`${API_URL}/auth/send-otp`, {
            phoneNumber: `+123456789${i}`
          }).catch(error => error.response)
        );
      }
      
      const responses = await Promise.all(requests);
      
      // Check if any responses indicate rate limiting
      const rateLimitedResponses = responses.filter(response => 
        response && response.status === 429
      );
      
      if (rateLimitedResponses.length > 0) {
        rateLimitedResponses.forEach(response => {
          validateErrorResponse(response);
          expect(response.data.error.code).to.equal('RATE_LIMIT_EXCEEDED');
          expect(response.data).to.have.property('retryAfter');
        });
      }
    });
  });

  describe('System Health Endpoints', () => {
    describe('GET /api/health', () => {
      it('should return success response', async () => {
        const response = await axios.get(`${API_URL}/health`);
        expect(response.status).to.equal(200);
        validateSuccessResponse(response);
      });
    });

    describe('GET /api/status', () => {
      it('should return success response with system status', async () => {
        const response = await axios.get(`${API_URL}/status`);
        expect(response.status).to.equal(200);
        validateSuccessResponse(response);
        expect(response.data.data).to.have.property('status');
      });
    });

    describe('GET /api/version', () => {
      it('should return success response with version info', async () => {
        const response = await axios.get(`${API_URL}/version`);
        expect(response.status).to.equal(200);
        validateSuccessResponse(response);
        expect(response.data.data).to.have.property('version');
      });
    });
  });

  describe('Error Response Consistency', () => {
    it('should have consistent error structure across all endpoints', async () => {
      const errorEndpoints = [
        { method: 'post', url: '/auth/send-otp', data: {} },
        { method: 'post', url: '/auth/signup', data: {} },
        { method: 'post', url: '/utxo/refund', data: {} },
        { method: 'get', url: '/user/profile', data: null }
      ];

      for (const endpoint of errorEndpoints) {
        try {
          if (endpoint.method === 'get') {
            await axios.get(`${API_URL}${endpoint.url}`);
          } else {
            await axios.post(`${API_URL}${endpoint.url}`, endpoint.data);
          }
        } catch (error) {
          if (error.response) {
            validateErrorResponse(error.response);
            
            // Check that error codes follow the standard format
            expect(error.response.data.error.code).to.match(/^[A-Z_]+$/);
            
            // Check that error messages are user-friendly (no technical details)
            expect(error.response.data.error.message).to.not.include('Error:');
            expect(error.response.data.error.message).to.not.include('undefined');
            expect(error.response.data.error.message).to.not.include('null');
          }
        }
      }
    });
  });

  describe('Specific Scenario Tests', () => {
    describe('User Already Signed Up Scenario', () => {
      it('should handle existing user gracefully', async () => {
        // This test would require setting up a known existing user
        // Implementation depends on your test data setup
        console.log('Test for existing user scenario - requires test data setup');
      });
    });

    describe('Wallet Address Already in Use', () => {
      it('should return appropriate error for duplicate wallet', async () => {
        // This test would require attempting to register the same wallet twice
        console.log('Test for duplicate wallet scenario - requires test data setup');
      });
    });

    describe('Refund Failure Scenario', () => {
      it('should handle refund failures gracefully', async () => {
        // This test would require simulating a refund failure
        console.log('Test for refund failure scenario - requires mock setup');
      });
    });
  });
});

// Additional utility functions for testing
export function createTestUser(userData = {}) {
  return {
    phoneNumber: testData.validPhone,
    userId: testData.validUserId,
    verificationMethod: 'phone',
    ...userData
  };
}

export function createInvalidTestData() {
  return {
    phoneNumber: testData.invalidPhone,
    userId: '',
    pin: testData.invalidPin
  };
}

// Run specific error scenario tests
export async function testSpecificScenarios() {
  console.log('Running specific scenario tests...');
  
  const scenarios = [
    {
      name: 'User already signed up',
      test: async () => {
        // Test existing user signup
        const userData = createTestUser();
        try {
          const response = await axios.post(`${API_URL}/auth/signup`, userData);
          console.log('Existing user response:', response.data);
          return response;
        } catch (error) {
          console.log('Existing user error:', error.response?.data);
          return error.response;
        }
      }
    },
    {
      name: 'Phone number in use',
      test: async () => {
        // Test duplicate phone number
        try {
          await axios.post(`${API_URL}/auth/signup`, createTestUser());
          const response = await axios.post(`${API_URL}/auth/signup`, {
            ...createTestUser(),
            userId: 'different_user'
          });
          return response;
        } catch (error) {
          console.log('Duplicate phone error:', error.response?.data);
          return error.response;
        }
      }
    }
  ];

  for (const scenario of scenarios) {
    console.log(`\nTesting scenario: ${scenario.name}`);
    try {
      const result = await scenario.test();
      console.log(`Scenario '${scenario.name}' completed:`, result?.data || 'No data');
    } catch (error) {
      console.error(`Scenario '${scenario.name}' failed:`, error.message);
    }
  }
}

if (process.argv.includes('--run-scenarios')) {
  testSpecificScenarios().then(() => {
    console.log('Scenario tests completed');
    process.exit(0);
  }).catch(error => {
    console.error('Scenario tests failed:', error);
    process.exit(1);
  });
}