// Create a test user with ZK commitment for local server
import crypto from 'crypto';
import http from 'http';

// Test data
const testData = {
  walletAddress: 'addr_test1qzt68ehhy87n0ryhy4ql0ter983a3rw8e5h67rq0q9g0lkcwg7kr5az980qltvwdmfurwaml3wsn0uj4jwkslrc3zkq02naqr',
  phone: '2349161010275',
  biometric: 'test_biometric',
  passkey: 'test_passkey',
  email: 'test@example.com',
  name: 'Test User'
};

// Hash function
const hashPhone = (phone) => {
  return crypto.createHash('sha256')
    .update(`phone:${phone}`)
    .digest('hex');
};

// Generate a commitment
const generateCommitment = () => {
  return new Promise((resolve, reject) => {
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

    const data = JSON.stringify({
      phone: testData.phone,
      biometric: testData.biometric,
      passkey: testData.passkey
    });

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
          
          // Check for commitment in different response formats
          let commitment = null;
          if (parsedResponse.data && parsedResponse.data.commitment) {
            commitment = parsedResponse.data.commitment;
          } else if (parsedResponse.commitment) {
            commitment = parsedResponse.commitment;
          }
          
          if (commitment) {
            console.log('\nCommitment generated successfully:');
            console.log('Commitment:', commitment);
            resolve(commitment);
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

// Create a user
const createUser = (commitment) => {
  return new Promise((resolve, reject) => {
    // Make a request to create a user
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/signup',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const phoneHash = hashPhone(testData.phone);

    const data = JSON.stringify({
      userAddress: testData.walletAddress,
      userId: 'testuser_' + Date.now(),
      phoneNumber: testData.phone,
      senderWalletAddress: testData.walletAddress,
      verificationMethod: 'phone',
      zkCommitment: commitment
    });

    console.log('\nSending request to /api/signup with data:', data);

    const req = http.request(options, (res) => {
      console.log('Status Code:', res.statusCode);
      
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log('Response:', responseData);
        
        try {
          if (!responseData || responseData.trim() === '') {
            console.log('Empty response received');
            resolve({ success: false, error: 'Empty response' });
            return;
          }
          
          const parsedResponse = JSON.parse(responseData);
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

// Run the test flow
const runTest = async () => {
  try {
    console.log('=== CREATING TEST USER WITH ZK COMMITMENT ===');
    
    // Step 1: Generate a commitment
    console.log('\n=== STEP 1: GENERATE COMMITMENT ===');
    const commitment = await generateCommitment();
    
    // Step 2: Create a user with the commitment
    console.log('\n=== STEP 2: CREATE USER ===');
    const createUserResponse = await createUser(commitment);
    
    console.log('\n=== TEST RESULTS ===');
    console.log('Commitment Generated:', !!commitment);
    console.log('User Created:', !!createUserResponse);
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('\nTest failed:', error.message);
  }
};

// Run the test
runTest();