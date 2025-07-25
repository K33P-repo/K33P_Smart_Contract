// Test script to verify refunds work regardless of user existence in database
import { EnhancedK33PManagerDB } from './dist/enhanced-k33p-manager-db.js';
import { dbService } from './dist/database/service.js';
import { config } from 'dotenv';

config();

// Force mock mode by setting environment variable BEFORE creating manager
process.env.USE_MOCK_DATABASE = 'true';

async function testRefundWithoutUser() {
  console.log('🧪 Testing refund functionality without existing user...');
  console.log('=' .repeat(60));
  
  try {
    // Initialize K33P manager in mock mode
    const k33pManager = new EnhancedK33PManagerDB();
    await k33pManager.initialize();
    
    // Test addresses (using valid Cardano testnet format)
    const testUserAddress = 'addr_test1qp8cjjan499llrgw6tyyzclxg8gxjxc9mwc4w7rqcx8jrmwza2v0vp3dk3jcdq47teay45jqy5zqx47h6u4zar2f07lqd6f8py';
    const testWalletAddress = 'addr_test1qquds2rqarqkk40lncfu88cwhptxekt7j0eccucpd2a43a35pel7jwkfmsf8zrjwsklm4czm5wqsgxwst5mrw86kt84qs7m4na';
    
    console.log(`\n📋 Test Configuration:`);
    console.log(`   User Address: ${testUserAddress}`);
    console.log(`   Wallet Address: ${testWalletAddress}`);
    
    // Check if user exists in database before test
    console.log('\n🔍 Checking if user exists in database...');
    const existingDeposit = await dbService.getDepositByUserAddress(testUserAddress);
    
    if (existingDeposit) {
      console.log(`✅ User exists in database with deposit ID: ${existingDeposit.id}`);
      console.log(`   Refunded status: ${existingDeposit.refunded}`);
    } else {
      console.log(`❌ User does NOT exist in database - perfect for testing!`);
    }
    
    // Test 1: Process refund without wallet address
    console.log('\n🚀 Test 1: Processing refund without wallet address...');
    const result1 = await k33pManager.processRefund(testUserAddress);
    
    console.log(`\n📊 Test 1 Results:`);
    console.log(`   Success: ${result1.success}`);
    console.log(`   Message: ${result1.message}`);
    if (result1.txHash) {
      console.log(`   Transaction Hash: ${result1.txHash}`);
    }
    
    // Test 2: Process refund with wallet address
    console.log('\n🚀 Test 2: Processing refund with wallet address...');
    const result2 = await k33pManager.processRefund(testUserAddress, testWalletAddress);
    
    console.log(`\n📊 Test 2 Results:`);
    console.log(`   Success: ${result2.success}`);
    console.log(`   Message: ${result2.message}`);
    if (result2.txHash) {
      console.log(`   Transaction Hash: ${result2.txHash}`);
    }
    
    // Check if deposit record was created
    console.log('\n🔍 Checking if deposit record was created...');
    const newDeposit = await dbService.getDepositByUserAddress(testUserAddress);
    
    if (newDeposit) {
      console.log(`✅ Deposit record created:`);
      console.log(`   User ID: ${newDeposit.user_id}`);
      console.log(`   User Address: ${newDeposit.user_address}`);
      console.log(`   Refunded: ${newDeposit.refunded}`);
      console.log(`   TX Hash: ${newDeposit.tx_hash}`);
    } else {
      console.log(`❌ No deposit record found`);
    }
    
    // Test 3: Try to refund again (should fail with "already refunded")
    console.log('\n🚀 Test 3: Attempting duplicate refund (should fail)...');
    const result3 = await k33pManager.processRefund(testUserAddress);
    
    console.log(`\n📊 Test 3 Results:`);
    console.log(`   Success: ${result3.success}`);
    console.log(`   Message: ${result3.message}`);
    
    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📋 TEST SUMMARY:');
    console.log(`   Test 1 (No wallet): ${result1.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Test 2 (With wallet): ${result2.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Test 3 (Duplicate): ${!result3.success ? '✅ PASSED' : '❌ FAILED'}`);
    
    const allTestsPassed = result1.success && result2.success && !result3.success;
    console.log(`\n🎯 OVERALL RESULT: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (allTestsPassed) {
      console.log('\n🎉 SUCCESS: Refunds now work regardless of user existence in database!');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
testRefundWithoutUser().catch(console.error);