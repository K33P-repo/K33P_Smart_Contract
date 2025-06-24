// Script to check backend wallet balance
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function main() {
  try {
    const apiKey = process.env.BLOCKFROST_API_KEY;
    // This is the backend wallet address from check-wallet.js
    const backendAddress = 'addr_test1vr8efgraqchktzel42mhy5qdzlr4fzpahtqqt43luzklkaq25ft6h';
    
    console.log('Blockfrost API Key:', apiKey);
    console.log('Backend Wallet Address:', backendAddress);
    
    // Fetch backend wallet details
    const addressResponse = await fetch(`https://cardano-preprod.blockfrost.io/api/v0/addresses/${backendAddress}`, {
      headers: {
        'project_id': apiKey
      }
    });
    
    const addressDetails = await addressResponse.json();
    console.log('Backend Wallet Details:', JSON.stringify(addressDetails, null, 2));
    
    // Fetch UTXOs at the backend wallet address
    const utxosResponse = await fetch(`https://cardano-preprod.blockfrost.io/api/v0/addresses/${backendAddress}/utxos`, {
      headers: {
        'project_id': apiKey
      }
    });
    
    const utxos = await utxosResponse.json();
    console.log('Backend Wallet UTXOs:', JSON.stringify(utxos, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();