// Script to update the backend wallet configuration to use the user's wallet
import { Lucid, Blockfrost } from 'lucid-cardano';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Hardcoded values for testing
const BLOCKFROST_URL = 'https://cardano-preprod.blockfrost.io/api/v0';
const BLOCKFROST_API_KEY = 'preprodbl7bIxYc2sbEeGAZyo2hpkjJwzOAQNtG';
const NETWORK = 'Preprod';

// User's wallet address
const USER_WALLET_ADDRESS = 'addr_test1qquds2rqarqkk40lncfu88cwhptxekt7j0eccucpd2a43a35pel7jwkfmsf8zrjwsklm4czm5wqsgxwst5mrw86kt84qs7m4na';

async function main() {
  try {
    console.log('Checking user wallet address...');
    console.log('User wallet address:', USER_WALLET_ADDRESS);
    
    // Read the current .env file
    const envPath = path.resolve('./backend/.env');
    console.log('Reading .env file from:', envPath);
    
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update the TEST_WALLET_ADDRESS in the .env file
    envContent = envContent.replace(
      /TEST_WALLET_ADDRESS=.*/,
      `TEST_WALLET_ADDRESS=${USER_WALLET_ADDRESS}`
    );
    
    // Write the updated .env file
    fs.writeFileSync(envPath, envContent);
    console.log('Updated TEST_WALLET_ADDRESS in .env file');
    
    // Create a test script to verify the wallet address works with the refund process
    const testScriptPath = path.resolve('./backend/test-user-wallet-refund.js');
    const testScriptContent = `// Test script to verify refund with user wallet address
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    // User wallet address from .env
    const userAddress = '${USER_WALLET_ADDRESS}';
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
`;
    
    fs.writeFileSync(testScriptPath, testScriptContent);
    console.log('Created test script at:', testScriptPath);
    console.log('\nNext steps:');
    console.log('1. Restart the backend server');
    console.log('2. Run the test script: node backend/test-user-wallet-refund.js');
  } catch (error) {
    console.error('Error:', error);
  }
}

main();