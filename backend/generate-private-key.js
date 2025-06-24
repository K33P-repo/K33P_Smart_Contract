// generate-private-key.js
import { Lucid, Blockfrost } from 'lucid-cardano';

async function generatePrivateKey() {
  try {
    console.log('Generating new private key for testing...');
    
    // Initialize Lucid with Blockfrost provider
    const lucid = await Lucid.new(
      new Blockfrost(
        'https://cardano-preprod.blockfrost.io/api/v0',
        'preprodbl7bIxYc2sbEeGAZyo2hpkjJwzOAQNtG'
      ),
      'Preprod'
    );
    
    // Generate a new key pair
    const privateKey = lucid.utils.generatePrivateKey();
    
    // Select wallet from the generated private key
    lucid.selectWalletFromPrivateKey(privateKey);
    
    // Get the address
    const address = await lucid.wallet.address();
    
    console.log('\n✅ New private key generated!');
    console.log('\nPrivate Key (add this to .env file as BACKEND_PRIVATE_KEY):');
    console.log(privateKey);
    console.log('\nAddress:');
    console.log(address);
    
    console.log('\nInstructions:');
    console.log('1. Replace the BACKEND_PRIVATE_KEY value in your .env file with the key above');
    console.log('2. Make sure to fund this address with some test ADA before using it');
    console.log('3. Restart your server after updating the .env file');
    
  } catch (error) {
    console.error('Error generating private key:', error);
  }
}

generatePrivateKey();