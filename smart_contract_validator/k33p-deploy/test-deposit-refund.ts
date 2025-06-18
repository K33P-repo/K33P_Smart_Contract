// test-deposit-refund.ts - Test script for K33P Smart Contract deposit and refund functionality
import { Lucid, Blockfrost, Data, fromText, toHex } from 'lucid-cardano';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Constants
const DEPOSIT_AMOUNT = 2_000_000; // 2 ADA in lovelace
const NETWORK: "Mainnet" | "Preview" | "Preprod" | "Custom" = (process.env.NETWORK as "Mainnet" | "Preview" | "Preprod" | "Custom") || 'Preprod';
const BLOCKFROST_API_KEY = process.env.BLOCKFROST_API_KEY;
const BLOCKFROST_URL = `https://cardano-${NETWORK.toLowerCase()}.blockfrost.io/api/v0`;

// Test wallet addresses
const TEST_WALLET_ADDRESS = 'addr_test1vqymx67q572k8z5ln0850m35a6amuw25wg09slrwuv9g0vq7zup5x';
const TEST_USER_ID = 'test_user_123';

// Define the Identity Datum Schema for Lucid
const IdentityDatumSchema = Data.Object({
  phone_hash: Data.Bytes(),
  biometric_hash: Data.Bytes(),
  passkey_hash: Data.Bytes(),
  wallet_address: Data.Bytes(),
  created_at: Data.Integer()
});

// Define the type for the schema
type IdentityDatum = Data.Static<typeof IdentityDatumSchema>;
// Cast the schema to the type
const IdentityDatum = IdentityDatumSchema as unknown as IdentityDatum;

// Initialize Lucid with Blockfrost provider
async function initLucid() {
  if (!BLOCKFROST_API_KEY) {
    throw new Error('BLOCKFROST_API_KEY not set in environment');
  }
  
  return await Lucid.new(
    new Blockfrost(
      BLOCKFROST_URL,
      BLOCKFROST_API_KEY
    ),
    NETWORK
  );
}

// Load private key from file
function getPrivateKey(keyPath: string) {
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Private key file not found at ${keyPath}`);
  }
  return fs.readFileSync(keyPath, 'utf8').trim();
}

// Get script address
async function getScriptAddress() {
  try {
    const lucid = await initLucid();
    
    // Load validator from plutus.json
    const plutusJSON = JSON.parse(fs.readFileSync('../plutus.json', 'utf8'));
    const validator = plutusJSON.validators[0].compiledCode;
    
    // Get script address
    const scriptAddress = lucid.utils.validatorToAddress(validator);
    return scriptAddress;
  } catch (error) {
    console.error('Error getting script address:', error);
    throw error;
  }
}

// Create mock user data
function createMockUserData() {
  // In a real scenario, these would be proper hashes
  return {
    phoneHash: '1234567890123456789012345678901234567890123456789012345678901234',
    biometricHash: '1234567890123456789012345678901234567890123456789012345678901234',
    passkeyHash: '1234567890123456789012345678901234567890123456789012345678901234',
  };
}

// Test deposit transaction
async function testDeposit() {
  try {
    console.log('\n🧪 TESTING DEPOSIT FUNCTIONALITY');
    console.log('-----------------------------------');
    
    // Initialize Lucid
    const lucid = await initLucid();
    
    // Get script address
    const scriptAddress = await getScriptAddress();
    console.log(`Script address: ${scriptAddress}`);
    
    // Load wallet from private key
    const privateKeyPath = '../../payment.skey';
    const privateKey = getPrivateKey(privateKeyPath);
    lucid.selectWalletFromPrivateKey(privateKey);
    
    // Get wallet address
    const walletAddress = await lucid.wallet.address();
    console.log(`Wallet address: ${walletAddress}`);
    
    // Create mock user data
    const userData = createMockUserData();
    
    // Create datum with user data
    const datumValue: IdentityDatum = {
      phone_hash: fromText(userData.phoneHash),
      biometric_hash: fromText(userData.biometricHash),
      passkey_hash: fromText(userData.passkeyHash),
      wallet_address: fromText(walletAddress),
      created_at: BigInt(Date.now())
    };
    const datum = Data.to(datumValue, IdentityDatum);
    
    // Build deposit transaction
    console.log(`Building deposit transaction of ${DEPOSIT_AMOUNT / 1_000_000} ADA...`);
    const tx = await lucid.newTx()
      .payToContract(
        scriptAddress,
        { inline: datum },
        { lovelace: BigInt(DEPOSIT_AMOUNT) }
      )
      .complete();
    
    const signedTx = await tx.sign().complete();
    const txHash = await signedTx.submit();
    
    console.log(`✅ Deposit transaction submitted successfully!`);
    console.log(`Transaction hash: ${txHash}`);
    console.log(`View transaction: https://preprod.cardanoscan.io/transaction/${txHash}`);
    
    // Save transaction details for refund test
    const depositDetails = {
      txHash,
      scriptAddress,
      walletAddress,
      amount: DEPOSIT_AMOUNT,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync('deposit-details.json', JSON.stringify(depositDetails, null, 2));
    console.log('Deposit details saved to deposit-details.json');
    
    return depositDetails;
  } catch (error) {
    console.error('❌ Error in deposit test:', error);
    throw error;
  }
}

// Test refund transaction
async function testRefund(depositDetails?: any) {
  try {
    console.log('\n🧪 TESTING REFUND FUNCTIONALITY');
    console.log('-----------------------------------');
    
    // Load deposit details if not provided
    if (!depositDetails) {
      if (!fs.existsSync('deposit-details.json')) {
        throw new Error('No deposit details found. Run testDeposit first.');
      }
      depositDetails = JSON.parse(fs.readFileSync('deposit-details.json', 'utf8'));
    }
    
    console.log(`Using deposit transaction: ${depositDetails.txHash}`);
    
    // Initialize Lucid
    const lucid = await initLucid();
    
    // Load backend wallet from private key
    const backendKeyPath = '../../backend.skey';
    const backendKey = getPrivateKey(backendKeyPath);
    lucid.selectWalletFromPrivateKey(backendKey);
    
    // Get UTXOs at script address
    console.log(`Fetching UTXOs at script address: ${depositDetails.scriptAddress}`);
    const utxos = await lucid.utxosAt(depositDetails.scriptAddress);
    
    // Find the UTXO from our deposit transaction
    const depositUtxo = utxos.find(utxo => utxo.txHash === depositDetails.txHash);
    
    if (!depositUtxo) {
      throw new Error(`UTXO from deposit transaction ${depositDetails.txHash} not found`);
    }
    
    console.log(`Found UTXO: ${depositUtxo.txHash}#${depositUtxo.outputIndex}`);
    
    // Build refund transaction
    console.log(`Building refund transaction of ${depositDetails.amount / 1_000_000} ADA...`);
    const tx = await lucid.newTx()
      .collectFrom([depositUtxo], Data.void()) // Use appropriate redeemer
      .payToAddress(depositDetails.walletAddress, { lovelace: BigInt(depositDetails.amount) })
      .complete();
    
    const signedTx = await tx.sign().complete();
    const txHash = await signedTx.submit();
    
    console.log(`✅ Refund transaction submitted successfully!`);
    console.log(`Transaction hash: ${txHash}`);
    console.log(`View transaction: https://preprod.cardanoscan.io/transaction/${txHash}`);
    
    // Save refund details
    const refundDetails = {
      originalTxHash: depositDetails.txHash,
      refundTxHash: txHash,
      walletAddress: depositDetails.walletAddress,
      amount: depositDetails.amount,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync('refund-details.json', JSON.stringify(refundDetails, null, 2));
    console.log('Refund details saved to refund-details.json');
    
    return refundDetails;
  } catch (error) {
    console.error('❌ Error in refund test:', error);
    throw error;
  }
}

// Main function to run tests
async function runTests() {
  try {
    console.log('🚀 Starting K33P Smart Contract Deposit and Refund Tests');
    console.log('====================================================');
    
    // Check if we should run deposit test
    const runDeposit = process.argv.includes('--deposit') || process.argv.includes('-d');
    
    // Check if we should run refund test
    const runRefund = process.argv.includes('--refund') || process.argv.includes('-r');
    
    // Run both tests if no specific test is specified
    const runBoth = !runDeposit && !runRefund;
    
    let depositDetails;
    
    if (runDeposit || runBoth) {
      depositDetails = await testDeposit();
      // Wait for transaction to be confirmed
      console.log('Waiting 60 seconds for transaction confirmation...');
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
    
    if (runRefund || runBoth) {
      await testRefund(depositDetails);
    }
    
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Tests failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests();