// Test script to check if the server is responding
import fetch from 'node-fetch';
import { getApiUrl } from './src/utils/api-url.js';

async function testServerHealth() {
  try {
    console.log('Testing server health...');
    
    const healthUrl = getApiUrl('/api/health');
  console.log(`Checking server health at ${healthUrl}`);
  const response = await fetch(healthUrl);
    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error testing server health:', error);
    throw error;
  }
}

testServerHealth().catch(console.error);