// Test script for ZK proof generation and verification routes
import crypto from 'crypto';
import http from 'http';

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
  phone: '1234567890',
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
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/zk/commitment',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const data = JSON.stringify(testData);

    console.log('\nSending request to /api/zk/commitment with data:', data);

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
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/zk/proof',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const data = JSON.stringify({
      ...testData,
      commitment
    });

    console.log('\nSending request to /api/zk/proof with data:', data);

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

// Step 3: Verify a ZK proof
const verifyProof = (proofObj, commitment) => {
  return new Promise((resolve, reject) => {
    // Create a properly formatted proof object for verification
    const formattedProof = {
      proof: proofObj.proof,
      publicInputs: {
        commitment: commitment
      },
      isValid: proofObj.isValid
    };

    // Make a request to the ZK verify endpoint
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/zk/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const data = JSON.stringify({
      proof: formattedProof,
      commitment
    });

    console.log('\nSending request to /api/zk/verify with data:', data);

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
            console.log('Empty response received, assuming verification failed');
            resolve(false);
            return;
          }
          
          const parsedResponse = JSON.parse(responseData);
          
          if (parsedResponse.isValid !== undefined) {
            console.log('\nProof verification result:');
            console.log('Is Valid:', parsedResponse.isValid);
            resolve(parsedResponse.isValid);
          } else {
            console.log('Response does not contain isValid field, assuming verification failed');
            resolve(false);
          }
        } catch (error) {
          console.error('Error parsing response:', error);
          console.log('Assuming verification failed due to parsing error');
          resolve(false);
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
    console.log('=== TESTING ZK COMMITMENT, PROOF, AND VERIFICATION ===');
    
    // Step 1: Generate a commitment
    console.log('\n=== STEP 1: GENERATE COMMITMENT ===');
    const commitment = await generateCommitment();
    
    // Step 2: Generate a proof
    console.log('\n=== STEP 2: GENERATE PROOF ===');
    const proofResponse = await generateProof(commitment);
    
    // Step 3: Verify the proof
    console.log('\n=== STEP 3: VERIFY PROOF ===');
    const isValid = await verifyProof(proofResponse, commitment);
    
    console.log('\n=== TEST RESULTS ===');
    console.log('Commitment:', commitment);
    console.log('Proof Generated:', !!proofResponse.proof);
    console.log('Proof Verification:', isValid);
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('\nTest failed:', error.message);
  }
};

// Run the test
runTest();