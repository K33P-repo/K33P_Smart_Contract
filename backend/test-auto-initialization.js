import { EnhancedK33PManagerDB } from './dist/enhanced-k33p-manager-db.js';
import { dbService } from './dist/database/service.js';
import { config } from 'dotenv';

config();

process.env.USE_MOCK_DATABASE = 'true';
process.env.DISABLE_CARDANO = 'true';

async function runAutoInitializationTest() {
  console.log('Testing EnhancedK33PManagerDB auto-initialization...');
  
  try {
    const k33pManager = new EnhancedK33PManagerDB();
    
    const testUserAddress = 'addr_test1qp8cjjan499llrgw6tyyzclxg8gxjxc9mwc4w7rqcx8jrmwza2v0vp3dk3jcdq47teay45jqy5zqx47h6u4zar2f07lqd6f8py';
    
    console.log('Calling processRefund on uninitialized manager...');
    const result = await k33pManager.processRefund(testUserAddress);
    
    console.log('Refund processing completed');
    console.log('Success status: ' + result.success);
    console.log('Transaction Hash: ' + result.txHash);
    
    if (result.success && result.txHash && result.txHash.startsWith('mock_refund_')) {
      console.log('Auto-initialization test passed successfully');
    } else {
      console.error('Auto-initialization test failed: invalid result');
      process.exit(1);
    }
  } catch (error) {
    console.error('Auto-initialization test failed with error: ' + error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runAutoInitializationTest().catch((error) => {
  console.error(error);
  process.exit(1);
});
