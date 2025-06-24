// Script to check UTXOs at the script address
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
    
    console.log('Blockfrost API Key:', apiKey);
    console.log('Script Address:', scriptAddress);
    
    // Fetch UTXOs at the script address
    const response = await fetch(`https://cardano-preprod.blockfrost.io/api/v0/addresses/${scriptAddress}/utxos`, {
      headers: {
        'project_id': apiKey
      }
    });
    
    const data = await response.json();
    console.log('Script UTXOs:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();