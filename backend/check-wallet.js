// Script to check the backend wallet address and UTXOs
import { Lucid, Blockfrost } from 'lucid-cardano';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Hardcoded values for testing
const BLOCKFROST_URL = 'https://cardano-preprod.blockfrost.io/api/v0';
const BLOCKFROST_API_KEY = 'preprod3W1XBWtJSpHSjqlHcrxuPo3uv2Q5BOFM';
const BACKEND_PRIVATE_KEY = '582057d5312245310f83c4ba6694bd777bb1c9fd28608bcb2d72ea7261263c56aec2';
const NETWORK = 'Preprod';

async function main() {
  try {
    // Initialize Lucid with Blockfrost provider
    console.log('Blockfrost URL:', BLOCKFROST_URL);
    console.log('Blockfrost API Key:', BLOCKFROST_API_KEY);
    
    const lucid = await Lucid.new(
      new Blockfrost(
        BLOCKFROST_URL,
        BLOCKFROST_API_KEY
      ),
      NETWORK
    );

    // Get the private key from environment
    const privateKey = BACKEND_PRIVATE_KEY;
    console.log('Using private key:', privateKey);

    // Select wallet and get address
    lucid.selectWalletFromPrivateKey(privateKey);
    const address = await lucid.wallet.address();
    console.log('Backend wallet address:', address);

    // Check UTXOs at the address
    console.log('Checking UTXOs at address...');
    const response = await fetch(`${BLOCKFROST_URL}/addresses/${address}/utxos`, {
      headers: {
        'project_id': BLOCKFROST_API_KEY
      }
    });

    const data = await response.json();
    console.log('Backend wallet UTXOs:', JSON.stringify(data, null, 2));

    // Check if there are any UTXOs
    if (Array.isArray(data) && data.length === 0) {
      console.log('No UTXOs found. The wallet needs to be funded.');
    } else if (data.error) {
      console.error('Error from Blockfrost:', data.error);
    } else {
      console.log(`Found ${data.length} UTXOs.`);
      // Calculate total lovelace
      let totalLovelace = 0;
      data.forEach(utxo => {
        utxo.amount.forEach(amt => {
          if (amt.unit === 'lovelace') {
            totalLovelace += parseInt(amt.quantity);
          }
        });
      });
      console.log(`Total balance: ${totalLovelace / 1000000} ADA`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();