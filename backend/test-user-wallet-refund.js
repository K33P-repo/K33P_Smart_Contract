// Test script to verify refund with user wallet address
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    // User wallet address from .env
    const userAddress = 'addr_test1qquds2rqarqkk40lncfu88cwhptxekt7j0eccucpd2a43a35pel7jwkfmsf8zrjwsklm4czm5wqsgxwst5mrw86kt84qs7m4na';
    console.log('Testing refund with user address:', userAddress);
    
    // Make the refund request
    const response = await fetch('http://localhost:3001/api/refund', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userAddress: userAddress,
        walletAddress: userAddress
      })
    });
    
    const data = await response.json();
    console.log('Response:', data);
    
    if (data.success) {
      console.log('✅ Refund successful!');
      console.log('Transaction hash:', data.txHash);
    } else {
      console.log('❌ Refund failed:', data.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
