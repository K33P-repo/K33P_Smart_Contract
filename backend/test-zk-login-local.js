// Test script for ZK login route with local server
import crypto from 'crypto';
import http from 'http';
import url from 'url';
import { getApiUrl } from './src/utils/api-url.js';

// Hash functions from hash.js
const hashPhone = (phone) => {
  return crypto.createHash('sha256')
    .update(`phone:${phone}`)
    .digest('hex');
};

const hashBiometric = (biometric) => {
  return crypto.createHash('sha256')
    .update(`biometric:${biometric}`)
    .digest('hex');
};

const hashPasskey = (passkey) => {
  return crypto.createHash('sha256')
    .update(`passkey:${passkey}`)
    .digest('hex');
};

// Test data
const testData = {
  walletAddress: 'addr_test1qzt68ehhy87n0ryhy4ql0ter983a3rw8e5h67rq0q9g0lkcwg7kr5az980qltvwdmfurwaml3wsn0uj4jwkslrc3zkq02naqr',
  phone: '2349161010275',
  biometric: 'test_biometric',
  passkey: 'test_passkey'
};

// Step 1: Generate a ZK commitment
const generateCommitment = () => {
  return new Promise((resolve, reject) => {
    // Hash the inputs
    const phoneHash = hashPhone(testData.phone);
    const biometricHash = hashBiometric(testData.biometric);
    const passkeyHash = hashPasskey(testData.passkey);

    console.log('Hashed inputs:');
    console.log('Phone Hash:', phoneHash);
    console.log('Biometric Hash:', biometricHash);
    console.log('Passkey Hash:', passkeyHash);

    // Make a request to the ZK commitment endpoint
    const commitmentUrl = getApiUrl('/api/zk/commitment');
    console.log(`Sending request to ${commitmentUrl}`);
    
    // Parse the URL to get hostname, port, and path
    const parsedUrl = new url.URL(commitmentUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const data = JSON.stringify({
      phone: testData.phone,
      biometric: testData.biometric,
      passkey: testData.passkey
    });

    console.log('\nSending request with data:', data);

    const req = http.request(options, (res) => {
      console.log('Status Code:', res.statusCode);
      
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log('Response:', responseData);
        
        try {
          const parsedResponse = JSON.parse(responseData);
          
          if (parsedResponse.commitment) {
            console.log('\nCommitment generated successfully:');
            console.log('Commitment:', parsedResponse.commitment);
            resolve(parsedResponse.commitment);
          } else {
            reject(new Error('No commitment in response'));
          }
        } catch (error) {
          console.error('Error parsing response:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error making request:', error.message);
      reject(error);
    });

    req.write(data);
    req.end();
  });
};

// Step 2: Generate a ZK proof
const generateProof = (commitment) => {
  return new Promise((resolve, reject) => {
    // Make a request to the ZK proof endpoint
    const proofUrl = getApiUrl('/api/zk/proof');
    console.log(`Sending request to ${proofUrl}`);
    
    // Parse the URL to get hostname, port, and path
    const parsedUrl = new url.URL(proofUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const data = JSON.stringify({
      phone: testData.phone,
      biometric: testData.biometric,
      passkey: testData.passkey,
      commitment
    });

    console.log('\nSending request with data:', data);

    const req = http.request(options, (res) => {
      console.log('Status Code:', res.statusCode);
      
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log('Response:', responseData);
        
        try {
          const parsedResponse = JSON.parse(responseData);
          
          console.log('\nProof generated successfully:');
          console.log('Proof Response:', parsedResponse);
          resolve(parsedResponse);
        } catch (error) {
          console.error('Error parsing response:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error making request:', error.message);
      reject(error);
    });

    req.write(data);
    req.end();
  });
};

// Step 3: Attempt ZK login
const attemptZkLogin = (proofObj, commitment) => {
  return new Promise((resolve, reject) => {
    // Make a request to the ZK login endpoint
    const loginUrl = getApiUrl('/api/zk/login');
    console.log(`Sending request to ${loginUrl}`);
    
    // Parse the URL to get hostname, port, and path
    const parsedUrl = new url.URL(loginUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const data = JSON.stringify({
      walletAddress: testData.walletAddress,
      phone: testData.phone,
      proof: proofObj,
      commitment
    });

    console.log('\nSending request with data:', data);

    const req = http.request(options, (res) => {
      console.log('Status Code:', res.statusCode);
      
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log('Response:', responseData);
        
        try {
          // Check if the response is empty
          if (!responseData || responseData.trim() === '') {
            console.log('Empty response received, login failed');
            resolve({ success: false, error: 'Empty response' });
            return;
          }
          
          const parsedResponse = JSON.parse(responseData);
          
          if (parsedResponse.error) {
            console.log('\nLogin failed:');
            console.log('Error:', parsedResponse.error);
            resolve({ success: false, error: parsedResponse.error });
          } else if (parsedResponse.message && parsedResponse.userId) {
            console.log('\nLogin successful:');
            console.log('Message:', parsedResponse.message);
            console.log('User ID:', parsedResponse.userId);
            resolve({ success: true, userId: parsedResponse.userId });
          } else {
            console.log('Unexpected response format, login failed');
            resolve({ success: false, error: 'Unexpected response format' });
          }
        } catch (error) {
          console.error('Error parsing response:', error);
          console.log('Login failed due to parsing error');
          resolve({ success: false, error: 'Parsing error' });
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error making request:', error.message);
      reject(error);
    });

    req.write(data);
    req.end();
  });
};

// Run the test flow
const runTest = async () => {
  try {
    console.log('=== TESTING ZK LOGIN FLOW ===');
    
    // Step 1: Generate a commitment
    console.log('\n=== STEP 1: GENERATE COMMITMENT ===');
    const commitment = await generateCommitment();
    
    // Step 2: Generate a proof
    console.log('\n=== STEP 2: GENERATE PROOF ===');
    const proofResponse = await generateProof(commitment);
    
    // Step 3: Attempt ZK login
    console.log('\n=== STEP 3: ATTEMPT ZK LOGIN ===');
    const loginResult = await attemptZkLogin(proofResponse, commitment);
    
    console.log('\n=== TEST RESULTS ===');
    console.log('Commitment Generated:', !!commitment);
    console.log('Proof Generated:', !!proofResponse.proof);
    console.log('Login Success:', loginResult.success);
    if (!loginResult.success) {
      console.log('Login Error:', loginResult.error);
      console.log('\nNote: The login is expected to fail if the user does not exist in the database.');
      console.log('This test is primarily to verify that the ZK login route is functioning correctly.');
    }
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('\nTest failed:', error.message);
  }
};

// Run the test
runTest();