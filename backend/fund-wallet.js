// Script to fund the backend wallet with test ADA
import { Lucid, Blockfrost } from 'lucid-cardano';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Hardcoded values for testing
const BLOCKFROST_URL = 'https://cardano-preprod.blockfrost.io/api/v0';
const BLOCKFROST_API_KEY = 'preprod3W1XBWtJSpHSjqlHcrxuPo3uv2Q5BOFM';
const BACKEND_PRIVATE_KEY = 'ed25519_sk1ekhrvcauqdum58jjf4tkqqtyz2wsud8kztuvjnm8uvdefvaju2ns6frqu2';
const NETWORK = 'Preprod';

// You need to provide a funded wallet private key here
// This should be a wallet with some test ADA that you control
const FUNDER_PRIVATE_KEY = ''; // Add your private key here

async function main() {
  try {
    // Initialize Lucid with Blockfrost provider
    console.log('Initializing Lucid...');
    const lucid = await Lucid.new(
      new Blockfrost(
        BLOCKFROST_URL,
        BLOCKFROST_API_KEY
      ),
      NETWORK
    );

    // Check if funder key is provided
    if (!FUNDER_PRIVATE_KEY) {
      console.error('Error: No funder private key provided. Please edit the script and add a private key for a wallet with test ADA.');
      return;
    }

    // Select funder wallet
    console.log('Selecting funder wallet...');
    lucid.selectWalletFromPrivateKey(FUNDER_PRIVATE_KEY);
    const funderAddress = await lucid.wallet.address();
    console.log('Funder wallet address:', funderAddress);

    // Get backend wallet address
    console.log('Getting backend wallet address...');
    const backendLucid = await Lucid.new(
      new Blockfrost(
        BLOCKFROST_URL,
        BLOCKFROST_API_KEY
      ),
      NETWORK
    );
    backendLucid.selectWalletFromPrivateKey(BACKEND_PRIVATE_KEY);
    const backendAddress = await backendLucid.wallet.address();
    console.log('Backend wallet address:', backendAddress);

    // Build and submit transaction
    console.log('Building transaction to send 5 ADA...');
    const tx = await lucid.newTx()
      .payToAddress(backendAddress, { lovelace: BigInt(5_000_000) }) // 5 ADA
      .complete();

    const signedTx = await tx.sign().complete();
    const txHash = await signedTx.submit();

    console.log('Transaction submitted successfully!');
    console.log('Transaction hash:', txHash);
    console.log('You can view the transaction at:');
    console.log(`https://preprod.cardanoscan.io/transaction/${txHash}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();