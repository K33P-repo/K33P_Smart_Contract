// Lucid SDK utilities for K33P Identity System
import { Lucid, Blockfrost, Data, fromText, toHex } from 'lucid-cardano';
import { bech32 } from 'bech32';
import fs from 'fs';

// load backend private key from file
function getBackendPrivateKey() {
  // First try to use the direct key from environment
  if (process.env.BACKEND_PRIVATE_KEY) {
    const key = process.env.BACKEND_PRIVATE_KEY.trim();
    console.log('Using BACKEND_PRIVATE_KEY from environment, length:', key.length);
    console.log('Key starts with:', key.substring(0, 10));
    
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
  
  // If not available, try to load from file
  const keyPath = process.env.BACKEND_PRIVATE_KEY_PATH;
  if (!keyPath) throw new Error('Neither BACKEND_PRIVATE_KEY nor BACKEND_PRIVATE_KEY_PATH set in environment');
  
  try {
    // Read the file content
    const fileContent = fs.readFileSync(keyPath, 'utf8');
    
    // Try to parse as JSON (for .skey format)
    try {
      const keyJson = JSON.parse(fileContent);
      if (keyJson.cborHex) {
        return keyJson.cborHex;
      }
    } catch (e) {
      // Not JSON, assume it's a raw key
    }
    
    // Return as raw content
    return fileContent.trim();
  } catch (error) {
    console.error('Error loading backend private key:', error);
    throw new Error('Failed to load backend private key');
  }
}

// Initialize Lucid with Blockfrost provider
const initLucid = async () => {
  return await Lucid.new(
    new Blockfrost(
      process.env.BLOCKFROST_URL,
      process.env.BLOCKFROST_API_KEY
    ),
    process.env.NETWORK || 'Preprod'
  );
};

// Define the Identity Datum Schema for Lucid
const IdentityDatumSchema = Data.Object({
  phone_hash: Data.Bytes(),
  biometric_hash: Data.Bytes(),
  passkey_hash: Data.Bytes(),
  wallet_address: Data.Bytes(),
  created_at: Data.Integer()
});

/**
 * Create a signup transaction
 * @param {string} userAddress - User's wallet address
 * @param {Object} userHashes - Object containing phone_hash, biometric_hash, and passkey_hash
 * @returns {Promise<string>} - Transaction hash
 */
const signupTxBuilder = async (userAddress, userHashes) => {
  try {
    // Initialize Lucid
    const lucid = await initLucid();
    
    // Load backend wallet from private key file
    lucid.selectWalletFromPrivateKey(getBackendPrivateKey());
    
    // Create datum with user hashes
    const datum = Data.to(
      {
        phone_hash: userHashes.phoneHash,
        biometric_hash: userHashes.biometricHash,
        passkey_hash: userHashes.passkeyHash,
        wallet_address: fromText(userAddress),
        created_at: BigInt(Date.now())
      },
      IdentityDatumSchema
    );
    
    // Build signup transaction
    const tx = await lucid.newTx()
      .payToContract(
        process.env.SCRIPT_ADDRESS,
        { inline: datum },
        { lovelace: BigInt(2_000_000) } // 2 ADA
      )
      .complete();
    
    const signedTx = await tx.sign().complete();
    return await signedTx.submit();
  } catch (error) {
    console.error('Signup transaction error:', error);
    throw new Error('Failed to create signup transaction');
  }
};

/**
 * Issue a refund for a UTXO
 * @param {string} ownerAddress - Owner's wallet address
 * @param {Object} scriptUtxo - UTXO to refund
 * @returns {Promise<string>} - Transaction hash
 */
const refundTx = async (ownerAddress, scriptUtxo) => {
  try {
    // Initialize Lucid
    const lucid = await initLucid();
    
    // Load backend wallet from private key file
    lucid.selectWalletFromPrivateKey(getBackendPrivateKey());
    
    // Build refund transaction
    const tx = await lucid.newTx()
      .collectFrom([scriptUtxo], { inline: Data.void() }) // Use appropriate redeemer
      .payToAddress(ownerAddress, { lovelace: BigInt(scriptUtxo.assets.lovelace) })
      .complete();
    
    const signedTx = await tx.sign().complete();
    return await signedTx.submit();
  } catch (error) {
    console.error('Refund transaction error:', error);
    throw new Error('Failed to issue refund');
  }
};

/**
 * Fetch UTXOs at script address
 * @param {string} phoneHash - Phone hash to filter UTXOs
 * @returns {Promise<Array>} - Array of UTXOs
 */
const fetchUtxos = async (phoneHash) => {
  try {
    // Initialize Lucid
    const lucid = await initLucid();
    
    // Fetch all UTXOs at the script address
    const utxos = await lucid.utxosAt(process.env.SCRIPT_ADDRESS);
    
    // Filter UTXOs by phone hash in datum
    return utxos.filter(utxo => {
      try {
        if (!utxo.datum) return false;
        
        const datum = Data.from(utxo.datum, IdentityDatumSchema);
        return toHex(datum.phone_hash) === phoneHash;
      } catch (error) {
        console.error('Error parsing datum:', error);
        return false;
      }
    });
  } catch (error) {
    console.error('Fetch UTXOs error:', error);
    throw new Error('Failed to fetch UTXOs');
  }
};

export {
  initLucid,
  IdentityDatumSchema,
  signupTxBuilder,
  refundTx,
  fetchUtxos
};