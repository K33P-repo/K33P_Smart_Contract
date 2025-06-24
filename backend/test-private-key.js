// test-private-key.js
import { Lucid, Blockfrost } from 'lucid-cardano';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve('./backend/.env') });

async function testPrivateKey() {
  try {
    console.log('Testing backend private key...');
    
    // Initialize Lucid
    const lucid = await Lucid.new(
      new Blockfrost(
        process.env.BLOCKFROST_URL,
        process.env.BLOCKFROST_API_KEY
      ),
      process.env.NETWORK || 'Preprod'
    );
    
    // Get the private key from environment
    const privateKey = process.env.BACKEND_PRIVATE_KEY;
    console.log('Private key from .env:', privateKey);
    
    if (!privateKey) {
      throw new Error('BACKEND_PRIVATE_KEY not found in environment');
    }
    
    // Try to select wallet using the private key
    try {
      lucid.selectWalletFromPrivateKey(privateKey);
      const address = await lucid.wallet.address();
      console.log('✅ Private key is valid!');
      console.log('Wallet address:', address);
    } catch (error) {
      console.error('❌ Invalid private key:', error.message);
    }
    
  } catch (error) {
    console.error('Error testing private key:', error);
  }
}

testPrivateKey();