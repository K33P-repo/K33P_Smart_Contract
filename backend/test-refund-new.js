// test-refund-new.js
import fetch from 'node-fetch';
import { getApiUrl } from './src/utils/api-url.js';

// The address that sent the 2 ADA
const userAddress = 'addr_test1qrvneqcvn04wudnuyvfyevvlds9calsnf0kuj2wq5vmlu75mxmtl5ak4yyqwvxp4wh2mdlmvqe9z84ukv3s82ykmplps4243xq';

// The transaction ID
const txHash = '7bb333c682b6404d6132dd37b64c95155ed4dfe8468ea234de398514b45de26f';

async function testRefund() {
  try {
    console.log('Testing refund endpoint...');
    console.log(`User address: ${userAddress}`);
    console.log(`Transaction hash: ${txHash}`);
    
    const refundUrl = getApiUrl('/api/refund');
  console.log(`Sending request to ${refundUrl}`);
  const response = await fetch(refundUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userAddress: userAddress,
        // Send refund back to the same address
        walletAddress: userAddress
      }),
    });

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('✅ Refund successful!');
      console.log(`Transaction hash: ${data.data.txHash}`);
    } else {
      console.log('❌ Refund failed!');
      console.log(`Error: ${data.error}`);
    }
  } catch (error) {
    console.error('Error testing refund:', error);
  }
}

testRefund();