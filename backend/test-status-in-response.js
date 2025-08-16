import express from 'express';
import { ResponseUtils } from './dist/middleware/error-handler.js';

const app = express();
app.use(express.json());

// Test success response with status code in body
app.get('/test-success', (req, res) => {
  console.log('\n=== Testing Success Response with Status Code in Body ===');
  return ResponseUtils.success(res, 'USER_CREATED', { userId: '12345' }, 'User created successfully', 201);
});

// Test error response with status code in body
app.get('/test-error', (req, res) => {
  console.log('\n=== Testing Error Response with Status Code in Body ===');
  return ResponseUtils.error(res, 'USERNAME_ALREADY_EXISTS', { username: 'testuser' });
});

// Test legacy success response with status code in body
app.get('/test-legacy', (req, res) => {
  console.log('\n=== Testing Legacy Success Response with Status Code in Body ===');
  return ResponseUtils.legacySuccess(res, { message: 'Legacy operation completed' }, 'Legacy success message', 200);
});

const PORT = 3003;
app.listen(PORT, () => {
  console.log(`Status code in response body test server running on port ${PORT}`);
  console.log('\nTest endpoints:');
  console.log(`- GET http://localhost:${PORT}/test-success`);
  console.log(`- GET http://localhost:${PORT}/test-error`);
  console.log(`- GET http://localhost:${PORT}/test-legacy`);
  console.log('\nCheck both console logs AND response bodies for status codes!');
});