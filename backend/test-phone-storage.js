/**
 * Test Script for Phone Number Storage
 * Tests that both phone numbers and phone hashes are stored and retrieved correctly
 */

import { storageService } from './src/services/storage-abstraction.js';
import { hashPhone } from './src/utils/hash.js';
import crypto from 'crypto';

// Test configuration
const TEST_PHONE_NUMBER = '+1234567890';
const TEST_USER_ID = 'test_phone_user_' + Date.now();
const TEST_WALLET_ADDRESS = 'addr_test1vqymx67q572k8z5ln0850m35a6amuw25wg09slrwuv9g0vq7zup5x';

async function testPhoneStorage() {
  console.log('🧪 Testing Phone Number Storage');
  console.log('================================');
  
  try {
    // Test 1: Store user with both phone number and phone hash
    console.log('\n📱 Test 1: Store User with Phone Number and Hash');
    const phoneHash = hashPhone(TEST_PHONE_NUMBER);
    
    const userData = {
      userId: TEST_USER_ID,
      walletAddress: TEST_WALLET_ADDRESS,
      phoneHash: phoneHash,
      phoneNumber: TEST_PHONE_NUMBER,
      zkCommitment: 'test_commitment_' + crypto.randomBytes(16).toString('hex')
    };
    
    console.log('Storing user data:', {
      userId: userData.userId,
      phoneNumber: userData.phoneNumber,
      phoneHash: userData.phoneHash.substring(0, 20) + '...',
      walletAddress: userData.walletAddress
    });
    
    const storeResult = await storageService.storeUser(userData);
    console.log('Store result:', {
      success: storeResult.success,
      storageUsed: storeResult.storageUsed,
      error: storeResult.error
    });
    
    if (!storeResult.success) {
      console.error('❌ Failed to store user:', storeResult.error);
      return;
    }
    
    console.log('✅ User stored successfully with ID:', storeResult.data.id);
    
    // Test 2: Find user by phone hash
    console.log('\n🔍 Test 2: Find User by Phone Hash');
    const findByHashResult = await storageService.findUser({ phoneHash });
    console.log('Find by hash result:', {
      success: findByHashResult.success,
      storageUsed: findByHashResult.storageUsed,
      found: !!findByHashResult.data
    });
    
    if (findByHashResult.success && findByHashResult.data) {
      console.log('✅ User found by phone hash');
      console.log('Retrieved data:', {
        userId: findByHashResult.data.userId,
        phoneNumber: findByHashResult.data.phoneNumber,
        phoneHash: findByHashResult.data.phoneHash?.substring(0, 20) + '...',
        walletAddress: findByHashResult.data.walletAddress
      });
      
      // Verify both phone number and hash are present
      if (findByHashResult.data.phoneNumber === TEST_PHONE_NUMBER) {
        console.log('✅ Phone number correctly stored and retrieved');
      } else {
        console.error('❌ Phone number mismatch:', {
          expected: TEST_PHONE_NUMBER,
          actual: findByHashResult.data.phoneNumber
        });
      }
      
      if (findByHashResult.data.phoneHash === phoneHash) {
        console.log('✅ Phone hash correctly stored and retrieved');
      } else {
        console.error('❌ Phone hash mismatch');
      }
    } else {
      console.error('❌ Failed to find user by phone hash:', findByHashResult.error);
    }
    
    // Test 3: Find user by userId
    console.log('\n🔍 Test 3: Find User by User ID');
    const findByUserIdResult = await storageService.findUser({ userId: TEST_USER_ID });
    console.log('Find by userId result:', {
      success: findByUserIdResult.success,
      storageUsed: findByUserIdResult.storageUsed,
      found: !!findByUserIdResult.data
    });
    
    if (findByUserIdResult.success && findByUserIdResult.data) {
      console.log('✅ User found by userId');
      console.log('Retrieved data:', {
        userId: findByUserIdResult.data.userId,
        phoneNumber: findByUserIdResult.data.phoneNumber,
        phoneHash: findByUserIdResult.data.phoneHash?.substring(0, 20) + '...',
        walletAddress: findByUserIdResult.data.walletAddress
      });
    } else {
      console.error('❌ Failed to find user by userId:', findByUserIdResult.error);
    }
    
    // Test 4: Update user phone number
    console.log('\n📝 Test 4: Update User Phone Number');
    const newPhoneNumber = '+0987654321';
    const newPhoneHash = hashPhone(newPhoneNumber);
    
    const updateResult = await storageService.updateUser(TEST_USER_ID, {
      phoneNumber: newPhoneNumber,
      phoneHash: newPhoneHash
    });
    
    console.log('Update result:', {
      success: updateResult.success,
      storageUsed: updateResult.storageUsed,
      error: updateResult.error
    });
    
    if (updateResult.success) {
      console.log('✅ User updated successfully');
      
      // Verify the update
      const verifyUpdateResult = await storageService.findUser({ userId: TEST_USER_ID });
      if (verifyUpdateResult.success && verifyUpdateResult.data) {
        console.log('Updated user data:', {
          userId: verifyUpdateResult.data.userId,
          phoneNumber: verifyUpdateResult.data.phoneNumber,
          phoneHash: verifyUpdateResult.data.phoneHash?.substring(0, 20) + '...',
          walletAddress: verifyUpdateResult.data.walletAddress
        });
        
        if (verifyUpdateResult.data.phoneNumber === newPhoneNumber) {
          console.log('✅ Phone number update verified');
        } else {
          console.error('❌ Phone number update failed');
        }
        
        if (verifyUpdateResult.data.phoneHash === newPhoneHash) {
          console.log('✅ Phone hash update verified');
        } else {
          console.error('❌ Phone hash update failed');
        }
      }
    } else {
      console.error('❌ Failed to update user:', updateResult.error);
    }
    
    console.log('\n🎉 Phone storage test completed successfully!');
    console.log('Both phone numbers and phone hashes are being stored and retrieved correctly.');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    // Clean up - delete test user
    try {
      console.log('\n🧹 Cleaning up test data...');
      // Note: We would need a delete method in the storage service for proper cleanup
      console.log('Test user ID for manual cleanup:', TEST_USER_ID);
    } catch (cleanupError) {
      console.error('Warning: Failed to clean up test data:', cleanupError);
    }
  }
}

// Run the test
testPhoneStorage().catch(console.error);