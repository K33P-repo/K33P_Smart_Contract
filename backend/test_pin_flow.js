// Test script to verify PIN signup and signin flow
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/auth';

// Test data
const testData = {
  phoneNumber: '+1234567890',
  pin: '1234',
  userId: 'test-user-' + Date.now(),
  username: 'testuser' + Date.now()
};

async function testPinFlow() {
  console.log('=== Testing PIN Signup and Signin Flow ===\n');
  
  try {
    // Step 1: Send OTP
    console.log('Step 1: Sending OTP...');
    const otpResponse = await axios.post(`${BASE_URL}/send-otp`, {
      phoneNumber: testData.phoneNumber
    });
    console.log('OTP Response:', otpResponse.data);
    
    if (!otpResponse.data.success) {
      throw new Error('Failed to send OTP');
    }
    
    const requestId = otpResponse.data.data.requestId;
    console.log('Request ID:', requestId);
    
    // Step 2: Verify OTP (using any code since it's a test implementation)
    console.log('\nStep 2: Verifying OTP...');
    const verifyResponse = await axios.post(`${BASE_URL}/verify-otp`, {
      requestId: requestId,
      code: '123456' // Any code works in test implementation
    });
    console.log('Verify Response:', verifyResponse.data);
    
    if (!verifyResponse.data.success) {
      throw new Error('Failed to verify OTP');
    }
    
    // Step 3: Complete signup with PIN
    console.log('\nStep 3: Completing signup with PIN...');
    const signupResponse = await axios.post(`${BASE_URL}/signup/pin`, {
      phoneNumber: testData.phoneNumber,
      pin: testData.pin,
      userId: testData.userId,
      username: testData.username,
      verificationMethod: 'pin'
    });
    console.log('Signup Response:', signupResponse.data);
    
    if (!signupResponse.data.success) {
      throw new Error('Failed to signup: ' + JSON.stringify(signupResponse.data));
    }
    
    console.log('✅ Signup completed successfully!');
    
    // Step 4: Send OTP for signin
    console.log('\nStep 4: Sending OTP for signin...');
    const signinOtpResponse = await axios.post(`${BASE_URL}/send-otp`, {
      phoneNumber: testData.phoneNumber
    });
    console.log('Signin OTP Response:', signinOtpResponse.data);
    
    if (!signinOtpResponse.data.success) {
      throw new Error('Failed to send OTP for signin');
    }
    
    const signinRequestId = signinOtpResponse.data.data.requestId;
    console.log('Signin Request ID:', signinRequestId);
    
    // Step 5: Verify OTP for signin
    console.log('\nStep 5: Verifying OTP for signin...');
    const signinVerifyResponse = await axios.post(`${BASE_URL}/verify-otp`, {
      requestId: signinRequestId,
      code: '123456' // Any code works in test implementation
    });
    console.log('Signin Verify Response:', signinVerifyResponse.data);
    
    if (!signinVerifyResponse.data.success) {
      throw new Error('Failed to verify OTP for signin');
    }
    
    // Step 6: Test signin with phone number, OTP, and PIN
    console.log('\nStep 6: Testing signin with phone number, OTP, and PIN...');
    const signinResponse = await axios.post(`${BASE_URL}/signin`, {
      phoneNumber: testData.phoneNumber,
      otpRequestId: signinRequestId,
      otpCode: '123456',
      pin: testData.pin
    });
    console.log('Signin Response:', signinResponse.data);
    
    if (!signinResponse.data.success) {
      throw new Error('Failed to signin: ' + JSON.stringify(signinResponse.data));
    }
    
    console.log('✅ Signin completed successfully!');
    console.log('\n=== All tests passed! ===');
    
    // Test with wrong PIN
    console.log('\nStep 7: Testing signin with wrong PIN...');
    try {
      // Send OTP again for wrong PIN test
      const wrongPinOtpResponse = await axios.post(`${BASE_URL}/send-otp`, {
        phoneNumber: testData.phoneNumber
      });
      const wrongPinRequestId = wrongPinOtpResponse.data.data.requestId;
      
      // Verify OTP
      await axios.post(`${BASE_URL}/verify-otp`, {
        requestId: wrongPinRequestId,
        code: '123456'
      });
      
      // Try signin with wrong PIN
      const wrongPinResponse = await axios.post(`${BASE_URL}/signin`, {
        phoneNumber: testData.phoneNumber,
        otpRequestId: wrongPinRequestId,
        otpCode: '123456',
        pin: '9999' // Wrong PIN
      });
      console.log('Wrong PIN should have failed, but got:', wrongPinResponse.data);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Wrong PIN correctly rejected');
      } else {
        console.log('❌ Unexpected error with wrong PIN:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

// Run the test
testPinFlow();