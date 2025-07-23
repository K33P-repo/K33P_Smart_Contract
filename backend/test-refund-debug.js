// test-refund-debug.js
import fetch from 'node-fetch';
import { getApiUrl } from './src/utils/api-url.js';
import fs from 'fs';
import path from 'path';

// The address that sent the 2 ADA
const userAddress = 'addr_test1qrvneqcvn04wudnuyvfyevvlds9calsnf0kuj2wq5vmlu75mxmtl5ak4yyqwvxp4wh2mdlmvqe9z84ukv3s82ykmplps4243xq';

// The transaction ID
const txHash = '7bb333c682b6404d6132dd37b64c95155ed4dfe8468ea234de398514b45de26f';

async function testRefund() {
  try {
    console.log('Testing refund endpoint...');
    console.log(`User address: ${userAddress}`);
    console.log(`Transaction hash: ${txHash}`);
    
    // First, let's check the deposits file
    const depositsPath = path.resolve('./user-deposits.json');
    console.log('Looking for deposits file at:', depositsPath);
    
    const deposits = JSON.parse(fs.readFileSync(depositsPath, 'utf8'));
    console.log('Current deposits:', JSON.stringify(deposits, null, 2));
    
    // Find the deposit for our user
    const deposit = deposits.find(d => d.userAddress === userAddress);
    console.log('Found deposit:', deposit ? JSON.stringify(deposit, null, 2) : 'Not found');
    
    // Create a UTXO object from deposit data (for debugging)
    if (deposit) {
      const scriptUtxo = {
        txHash: deposit.txHash,
        outputIndex: 0,
        assets: {
          lovelace: deposit.amount
        }
      };
      console.log('Script UTXO that would be used:', JSON.stringify(scriptUtxo, null, 2));
    }
    
    // Now call the refund endpoint
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
    } else {
      console.log('❌ Refund failed:', data.message);
    }
  } catch (error) {
    console.error('Error testing refund:', error);
  }
}

testRefund();