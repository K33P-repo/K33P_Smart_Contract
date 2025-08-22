// Script to clear rate limiter cache for testing
import fetch from 'node-fetch';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

async function clearRateLimit() {
  try {
    console.log('🔄 Attempting to clear rate limiter cache...');
    
    // Make a request to a non-existent endpoint to trigger rate limiter reset
    // This is a workaround since we don't have a direct API to clear the cache
    
    console.log('⏰ Waiting for rate limit window to expire naturally...');
    console.log('Rate limit window is 15 minutes, waiting 16 minutes to be safe...');
    
    // Wait 16 minutes (960 seconds) for the rate limit to expire
    const waitTime = 16 * 60 * 1000; // 16 minutes in milliseconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < waitTime) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.floor((waitTime - (Date.now() - startTime)) / 1000);
      process.stdout.write(`\r⏳ Elapsed: ${elapsed}s, Remaining: ${remaining}s`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n✅ Rate limit window should have expired!');
    console.log('🧪 You can now run the PIN storage verification test.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

clearRateLimit();