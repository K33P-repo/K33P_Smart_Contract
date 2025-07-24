/**
 * Test Script for Storage Integration
 * Tests the storage abstraction layer with both Iagon and PostgreSQL fallback
 */

import { storageService } from './src/services/storage-abstraction.js';
import crypto from 'crypto';

// Test configuration
const TEST_USER_ID = 'test_user_' + Date.now();
const TEST_WALLET_ADDRESS = 'addr_test1vqymx67q572k8z5ln0850m35a6amuw25wg09slrwuv9g0vq7zup5x';
const TEST_PHONE_HASH = 'test_phone_hash_' + crypto.randomBytes(16).toString('hex');

async function testStorageIntegration() {
  console.log('🧪 Starting Storage Integration Tests');
  console.log('=' .repeat(50));

  try {
    // Test 1: Check storage health
    console.log('\n📊 Test 1: Storage Health Check');
    const health = storageService.getHealthStatus();
    console.log('Iagon available:', health.iagon.available);
    console.log('PostgreSQL available:', health.postgresql.available);
    console.log('Iagon response time:', health.iagon.responseTime, 'ms');
    console.log('PostgreSQL response time:', health.postgresql.responseTime, 'ms');
    
    if (health.iagon.lastError) {
      console.log('Iagon last error:', health.iagon.lastError);
    }
    if (health.postgresql.lastError) {
      console.log('PostgreSQL last error:', health.postgresql.lastError);
    }

    // Test 2: Store a new user
    console.log('\n👤 Test 2: Store New User');
    const userData = {
      userId: TEST_USER_ID,
      walletAddress: TEST_WALLET_ADDRESS,
      phoneHash: TEST_PHONE_HASH,
      zkCommitment: 'test_commitment_' + crypto.randomBytes(16).toString('hex'),
      verificationMethod: 'phone',
      verified: false
    };

    console.log('Storing user with data:', {
      userId: userData.userId,
      walletAddress: userData.walletAddress,
      phoneHash: userData.phoneHash.substring(0, 10) + '...',
      zkCommitment: userData.zkCommitment.substring(0, 10) + '...'
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

    // Test 3: Find user by userId
    console.log('\n🔍 Test 3: Find User by UserId');
    const findByUserIdResult = await storageService.findUser({ userId: TEST_USER_ID });
    console.log('Find by userId result:', {
      success: findByUserIdResult.success,
      found: !!findByUserIdResult.data,
      storageUsed: findByUserIdResult.storageUsed,
      error: findByUserIdResult.error
    });

    if (findByUserIdResult.success && findByUserIdResult.data) {
      console.log('✅ User found by userId:', {
        userId: findByUserIdResult.data.userId,
        walletAddress: findByUserIdResult.data.walletAddress,
        verified: findByUserIdResult.data.verified
      });
    } else {
      console.error('❌ Failed to find user by userId');
    }

    // Test 4: Find user by wallet address
    console.log('\n🔍 Test 4: Find User by Wallet Address');
    const findByWalletResult = await storageService.findUser({ walletAddress: TEST_WALLET_ADDRESS });
    console.log('Find by wallet result:', {
      success: findByWalletResult.success,
      found: !!findByWalletResult.data,
      storageUsed: findByWalletResult.storageUsed,
      error: findByWalletResult.error
    });

    if (findByWalletResult.success && findByWalletResult.data) {
      console.log('✅ User found by wallet address');
    } else {
      console.log('⚠️  User not found by wallet address (expected for Iagon primary storage)');
    }

    // Test 5: Find user by phone hash
    console.log('\n🔍 Test 5: Find User by Phone Hash');
    const findByPhoneResult = await storageService.findUser({ phoneHash: TEST_PHONE_HASH });
    console.log('Find by phone result:', {
      success: findByPhoneResult.success,
      found: !!findByPhoneResult.data,
      storageUsed: findByPhoneResult.storageUsed,
      error: findByPhoneResult.error
    });

    if (findByPhoneResult.success && findByPhoneResult.data) {
      console.log('✅ User found by phone hash');
    } else {
      console.log('⚠️  User not found by phone hash (expected for Iagon primary storage)');
    }

    // Test 6: Update user
    console.log('\n✏️  Test 6: Update User');
    const updateData = {
      verified: true,
      senderWalletAddress: 'addr_test1sender123',
      txHash: 'test_tx_hash_' + crypto.randomBytes(16).toString('hex')
    };

    const updateResult = await storageService.updateUser(TEST_USER_ID, updateData);
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
          verified: verifyUpdateResult.data.verified,
          senderWalletAddress: verifyUpdateResult.data.senderWalletAddress,
          txHash: verifyUpdateResult.data.txHash
        });
      }
    } else {
      console.error('❌ Failed to update user:', updateResult.error);
    }

    // Test 7: Store user deposit
    console.log('\n💰 Test 7: Store User Deposit');
    const depositData = {
      userId: TEST_USER_ID,
      userAddress: TEST_WALLET_ADDRESS,
      phoneHash: TEST_PHONE_HASH,
      amount: 2000000, // 2 ADA in lovelace
      txHash: 'deposit_tx_' + crypto.randomBytes(16).toString('hex'),
      timestamp: new Date(),
      refunded: false,
      signupCompleted: true,
      verified: true,
      verificationAttempts: 1,
      senderWalletAddress: 'addr_test1sender123'
    };

    const depositResult = await storageService.storeUserDeposit(depositData);
    console.log('Deposit store result:', {
      success: depositResult.success,
      storageUsed: depositResult.storageUsed,
      error: depositResult.error
    });

    if (depositResult.success) {
      console.log('✅ Deposit stored successfully with ID:', depositResult.data.id);
    } else {
      console.error('❌ Failed to store deposit:', depositResult.error);
    }

    // Test 8: Find user deposits
    console.log('\n🔍 Test 8: Find User Deposits');
    const findDepositsResult = await storageService.findUserDeposits({ userId: TEST_USER_ID });
    console.log('Find deposits result:', {
      success: findDepositsResult.success,
      count: findDepositsResult.data ? findDepositsResult.data.length : 0,
      storageUsed: findDepositsResult.storageUsed,
      error: findDepositsResult.error
    });

    if (findDepositsResult.success && findDepositsResult.data && findDepositsResult.data.length > 0) {
      console.log('✅ Found deposits:', findDepositsResult.data.map(d => ({
        id: d.id,
        amount: d.amount,
        verified: d.verified,
        refunded: d.refunded
      })));
    } else {
      console.log('⚠️  No deposits found (expected for Iagon primary storage)');
    }

    // Test 9: Storage fallback simulation
    console.log('\n🔄 Test 9: Storage Fallback Behavior');
    console.log('Current primary storage:', process.env.PRIMARY_STORAGE || 'iagon');
    console.log('Fallback enabled:', process.env.ENABLE_STORAGE_FALLBACK !== 'false');
    
    if (health.iagon.available && health.postgresql.available) {
      console.log('✅ Both storages available - fallback ready');
    } else if (health.iagon.available) {
      console.log('⚠️  Only Iagon available');
    } else if (health.postgresql.available) {
      console.log('⚠️  Only PostgreSQL available - using fallback');
    } else {
      console.log('❌ No storage available');
    }

    console.log('\n🎉 Storage Integration Tests Completed');
    console.log('=' .repeat(50));

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('Error stack:', error.stack);
  } finally {
    // Cleanup: Shutdown storage service
    console.log('\n🧹 Cleaning up...');
    await storageService.shutdown();
    console.log('✅ Storage service shutdown complete');
    process.exit(0);
  }
}

// Run the tests
testStorageIntegration().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});