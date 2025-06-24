// Test script to check if the server is responding
import fetch from 'node-fetch';

async function testServerHealth() {
  try {
    console.log('Testing server health...');
    
    const response = await fetch('http://localhost:3001/api/health');
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