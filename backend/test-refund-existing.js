// Test script to refund an existing deposit
import fetch from 'node-fetch';

async function testRefund() {
  try {
    // This address has a deposit in user-deposits.json
    const userAddress = 'addr_test1qrvneqcvn04wudnuyvfyevvlds9calsnf0kuj2wq5vmlu75mxmtl5ak4yyqwvxp4wh2mdlmvqe9z84ukv3s82ykmplps4243xq';
    
    console.log('Testing refund with existing deposit address:', userAddress);
    
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
    
    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('✅ Refund successful!');
      console.log('Transaction hash:', data.txHash);
    } else {
      console.log('❌ Refund failed:', data.message);
    }
  } catch (error) {
    console.error('Error testing refund:', error);
  }
}

testRefund();