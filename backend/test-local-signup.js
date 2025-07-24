// Test signup locally with all required hashed inputs
import crypto from 'crypto';
import { generateZkCommitment, generateZkProof } from './src/utils/zk.js';

/**
 * Hash a string using SHA-256
 * @param {string} input - The input to hash
 * @param {string} salt - Optional salt
 * @returns {string} - The hash
 */
function hashInput(input, salt = '') {
  return crypto.createHash('sha256')
    .update(input + salt)
    .digest('hex');
}

/**
 * Test ZK commitment and proof generation locally
 */
async function testZkFunctions() {
  try {
    console.log('=== Testing ZK Functions Locally ===');
    
    // Generate test data
    const timestamp = Date.now();
    const testPhone = `+1234567${timestamp.toString().slice(-3)}`;
    const testBiometric = `biometric_data_${timestamp}`;
    const testPasskey = `passkey_${timestamp}`;
    const testPin = '123456';
    
    console.log('\n=== Test Data ===');
    console.log('Phone:', testPhone);
    console.log('Biometric:', testBiometric);
    console.log('Passkey:', testPasskey);
    console.log('PIN:', testPin);
    
    // Generate hashes
    const phoneHash = hashInput(testPhone, 'default-salt');
    const biometricHash = hashInput(testBiometric);
    const passkeyHash = hashInput(testPasskey);
    const pinHash = hashInput(testPin);
    
    console.log('\n=== Generated Hashes ===');
    console.log('Phone Hash:', phoneHash);
    console.log('Biometric Hash:', biometricHash);
    console.log('Passkey Hash:', passkeyHash);
    console.log('PIN Hash:', pinHash);
    
    // Test ZK commitment with all hashes
    console.log('\n=== Testing ZK Commitment (All Hashes) ===');
    const commitmentAll = generateZkCommitment({
      phoneHash,
      biometricHash,
      passkeyHash
    });
    console.log('ZK Commitment (All):', commitmentAll);
    
    // Test ZK commitment with only phone hash
    console.log('\n=== Testing ZK Commitment (Phone Only) ===');
    const commitmentPhone = generateZkCommitment({
      phoneHash
    });
    console.log('ZK Commitment (Phone Only):', commitmentPhone);
    
    // Test ZK proof generation
    console.log('\n=== Testing ZK Proof Generation ===');
    const proof = generateZkProof({
      phone: testPhone,
      biometric: testBiometric,
      passkey: testPasskey
    }, commitmentAll);
    console.log('ZK Proof:', JSON.stringify(proof, null, 2));
    
    // Test with minimal data (phone only)
    console.log('\n=== Testing ZK Proof (Phone Only) ===');
    const proofMinimal = generateZkProof({
      phone: testPhone
    }, commitmentPhone);
    console.log('ZK Proof (Minimal):', JSON.stringify(proofMinimal, null, 2));
    
    console.log('\n✅ All ZK functions working correctly!');
    
    // Prepare complete signup data structure
    console.log('\n=== Complete Signup Data Structure ===');
    const signupData = {
      userAddress: 'addr_test1qz' + crypto.randomBytes(28).toString('hex'),
      userId: `user_${timestamp}`,
      phoneNumber: testPhone,
      pin: testPin,
      verificationMethod: 'phone',
      // All hashed inputs
      phoneHash: phoneHash,
      biometricHash: biometricHash,
      passkeyHash: passkeyHash,
      pinHash: pinHash,
      // Raw inputs for ZK proof
      phone: testPhone,
      biometric: testBiometric,
      passkey: testPasskey,
      // ZK commitment and proof
      zkCommitment: commitmentAll,
      zkProof: proof
    };
    
    console.log('Complete Signup Data:');
    console.log(JSON.stringify(signupData, null, 2));
    
    return signupData;
    
  } catch (error) {
    console.error('Error in ZK function test:', error.message);
    console.error('Stack:', error.stack);
    return null;
  }
}

// Run the test
testZkFunctions();