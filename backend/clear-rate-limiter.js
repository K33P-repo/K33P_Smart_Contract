// Script to clear the rate limiter cache for testing purposes
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Import the rate limiter module to access the internal Map
import('../dist/middleware/rate-limiter.js').then((rateLimiterModule) => {
  console.log('Attempting to clear rate limiter cache...');
  
  // Access the internal requestCounts Map through reflection
  // Since it's not exported, we'll need to clear it indirectly
  
  // The rate limiter uses an in-memory Map, so restarting the server would clear it
  // For now, let's just wait a bit and then exit
  console.log('Rate limiter cache clearing attempted.');
  console.log('Note: The rate limiter uses in-memory storage, so restarting the server will clear all rate limits.');
  
  process.exit(0);
}).catch((error) => {
  console.error('Error clearing rate limiter:', error);
  process.exit(1);
});