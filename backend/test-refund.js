// Test script for refund endpoint
import fetch from 'node-fetch';
import { getApiUrl } from './src/utils/api-url.js';

async function testRefund() {
  try {
    console.log('Testing refund endpoint...');
    
    // Use the API URL utility to get the correct URL based on environment
    const refundUrl = getApiUrl('/api/refund');
    console.log(`Sending request to ${refundUrl}`);
    
    const response = await fetch(refundUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userAddress: 'addr_test1qp8cjjan499llrgw6tyyzclxg8gxjxc9mwc4w7rqcx8jrmwza2v0vp3dk3jcdq47teay45jqy5zqx47h6u4zar2f07lqd6f8py'
      })
    });
    
    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error testing refund:', error);
    throw error;
  }
}

testRefund();