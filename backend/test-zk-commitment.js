// Test script for ZK commitment route
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
        console.log('\nVerifying commitment matches our hashed inputs...');
        console.log('Commitment from server:', parsedResponse.commitment);
        console.log('Hashes from server:', parsedResponse.hashes);
        
        // Verify the hashes match what we calculated
        console.log('\nHash verification:');
        console.log('Phone hash matches:', phoneHash === parsedResponse.hashes.phoneHash);
        console.log('Biometric hash matches:', biometricHash === parsedResponse.hashes.biometricHash);
        console.log('Passkey hash matches:', passkeyHash === parsedResponse.hashes.passkeyHash);
      }
    } catch (error) {
      console.error('Error parsing response:', error);
    }
  });
});

req.on('error', (error) => {
  console.error('Error making request:', error.message);
});

req.write(data);
req.end();