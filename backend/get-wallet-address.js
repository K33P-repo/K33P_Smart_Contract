// Simple script to get the backend wallet address
import { initLucid } from './src/utils/lucid.js';
import { Lucid, Blockfrost } from 'lucid-cardano';
import { bech32 } from 'bech32';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Function to get backend private key (copied from lucid.js)
function getBackendPrivateKey() {
  if (process.env.BACKEND_PRIVATE_KEY) {
    const key = process.env.BACKEND_PRIVATE_KEY.trim();
    console.log('Using BACKEND_PRIVATE_KEY from environment, length:', key.length);
    
    // If the key is in cborHex format (starts with 5820), convert to bech32 ed25519_sk format
    if (key.startsWith('5820') && key.length === 68) {
      // Remove the CBOR prefix (5820) to get the 64-character private key
      const hexKey = key.substring(4);
      console.log('Extracted hex private key from cborHex, length:', hexKey.length);
      
      // Convert hex to bytes
      const keyBytes = Buffer.from(hexKey, 'hex');
      
      // Convert to bech32 with ed25519_sk prefix
      const words = bech32.toWords(keyBytes);
      const bech32Key = bech32.encode('ed25519_sk', words);
      console.log('Converted to bech32 ed25519_sk format:', bech32Key.substring(0, 20) + '...');
      
      return bech32Key;
    }
    
    return key;
  }
  throw new Error('BACKEND_PRIVATE_KEY not found in environment');
}

async function getWalletAddress() {
  try {
    console.log('Getting backend wallet address...');
    const lucid = await initLucid();
    lucid.selectWalletFromPrivateKey(getBackendPrivateKey());
    const address = await lucid.wallet.address();
    console.log('Backend wallet address:', address);
    return address;
  } catch (error) {
    console.error('Error getting wallet address:', error);
  }
}

getWalletAddress();