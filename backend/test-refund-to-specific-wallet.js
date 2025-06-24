// Test script to refund to a specific wallet address - refunding to the wallet that sent the ADA
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { getApiUrl } from './src/utils/api-url.js';

async function testRefundToSpecificWallet() {
  try {
    console.log('Starting refund test to specific wallet...');
    
    // This address has a deposit in user-deposits.json
    const userAddress = 'addr_test1qrvneqcvn04wudnuyvfyevvlds9calsnf0kuj2wq5vmlu75mxmtl5ak4yyqwvxp4wh2mdlmvqe9z84ukv3s82ykmplps4243xq';
    
    // The wallet address that sent the ADA to the backend wallet
    // This should be the address you used to send ADA to the backend wallet
    const walletAddress = 'addr_test1qp0al5v8mvwv9mzn77ls0tev3v0g9hggmhk3crpnjr7z4xq3c6pdpd6xpv8zsdumeu2wt0vvnwmq08t3n6300tmc5pjqwp5x0u';
    
    console.log('Testing refund with existing deposit address:', userAddress);
    console.log('Refunding to wallet address:', walletAddress);
    
    // Check environment variables
    console.log('Environment variables:');
    console.log('BLOCKFROST_URL:', process.env.BLOCKFROST_URL);
    console.log('BLOCKFROST_API_KEY:', process.env.BLOCKFROST_API_KEY ? 'Set' : 'Not set');
    console.log('SCRIPT_ADDRESS:', process.env.SCRIPT_ADDRESS);
    console.log('SCRIPT_HASH:', process.env.SCRIPT_HASH);
    console.log('BACKEND_PRIVATE_KEY:', process.env.BACKEND_PRIVATE_KEY ? 'Set' : 'Not set');
    console.log('BACKEND_PRIVATE_KEY_PATH:', process.env.BACKEND_PRIVATE_KEY_PATH);
    
    // First, let's check the deposits file
    const depositsPath = path.resolve('./user-deposits.json');
    console.log('Looking for deposits file at:', depositsPath);
    
    try {
      const deposits = JSON.parse(fs.readFileSync(depositsPath, 'utf8'));
      console.log('Current deposits:', JSON.stringify(deposits, null, 2));
      
      // Find the deposit for our user
      const deposit = deposits.find(d => d.userAddress === userAddress);
      console.log('Found deposit:', deposit ? JSON.stringify(deposit, null, 2) : 'Not found');
      
      if (deposit) {
        // Create a UTXO object from deposit data (for debugging)
        const scriptUtxo = {
          txHash: deposit.txHash,
          outputIndex: 0, // Assuming output index is 0
          assets: {
            lovelace: deposit.amount
          }
        };
        console.log('Script UTXO that will be used:', JSON.stringify(scriptUtxo, null, 2));
      }
    } catch (error) {
      console.error('Error reading deposits file:', error);
    }
    
    // Check if script UTXOs exist at the script address
    try {
      console.log('Checking script UTXOs...');
      const apiKey = process.env.BLOCKFROST_API_KEY;
      const scriptAddress = process.env.SCRIPT_ADDRESS;
      
      if (!apiKey || !scriptAddress) {
        console.error('Missing BLOCKFROST_API_KEY or SCRIPT_ADDRESS environment variables');
      } else {
        console.log('Fetching UTXOs at script address:', scriptAddress);
        const response = await fetch(`https://cardano-preprod.blockfrost.io/api/v0/addresses/${scriptAddress}/utxos`, {
          headers: {
            'project_id': apiKey
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Script UTXOs found:', data.length);
          // Only log the first few UTXOs to avoid overwhelming the console
          if (data.length > 0) {
            console.log('First UTXO:', JSON.stringify(data[0], null, 2));
          }
        } else {
          console.error('Failed to fetch script UTXOs:', await response.text());
        }
      }
    } catch (error) {
      console.error('Error checking script UTXOs:', error);
    }
    
    const refundUrl = getApiUrl('/api/refund');
  console.log(`Sending request to ${refundUrl}`);
  const response = await fetch(refundUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userAddress: userAddress,
        walletAddress: walletAddress
      })
    });
    
    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error testing refund:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

console.log('Script started');
testRefundToSpecificWallet()
  .then(result => {
    console.log('Test completed successfully');
    console.log('Result:', JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('Test failed with error:', error);
    console.error('Error stack:', error.stack);
  });
console.log('Script execution initiated');