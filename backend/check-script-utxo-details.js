// Script to check specific UTXO details at the script address
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
    const scriptAddress = process.env.SCRIPT_ADDRESS;
    const txHash = '7bb333c682b6404d6132dd37b64c95155ed4dfe8468ea234de398514b45de26f'; // From user-deposits.json
    
    console.log('Blockfrost API Key:', apiKey);
    console.log('Script Address:', scriptAddress);
    console.log('Transaction Hash:', txHash);
    
    // Fetch UTXOs at the script address
    const utxosResponse = await fetch(`https://cardano-preprod.blockfrost.io/api/v0/addresses/${scriptAddress}/utxos`, {
      headers: {
        'project_id': apiKey
      }
    });
    
    const utxos = await utxosResponse.json();
    console.log('Script UTXOs:', JSON.stringify(utxos, null, 2));
    
    // Fetch specific transaction details
    const txResponse = await fetch(`https://cardano-preprod.blockfrost.io/api/v0/txs/${txHash}/utxos`, {
      headers: {
        'project_id': apiKey
      }
    });
    
    const txDetails = await txResponse.json();
    console.log('Transaction Details:', JSON.stringify(txDetails, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();