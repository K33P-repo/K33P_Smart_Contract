const fs = require('fs');
const path = require('path');
const blake = require('blakejs');

// Blake2b_224 hash function (28 bytes = 224 bits)
function blake2b224Hex(input) {
  const inputBytes = Buffer.from(input, 'utf8');
  const hashBytes = blake.blake2b(inputBytes, null, 28);
  return Buffer.from(hashBytes).toString('hex');
}

// Ensure correct structure and update Datum JSON
function updateDatum(filePath, phone, biometric, passkey, wallet, createdAt) {
  const expectedKeys = ['phone_hash', 'biometric_hash', 'passkey_hash', 'wallet_address', 'created_at'];
  let datum = {};

  // Try to load and validate existing datum
  if (fs.existsSync(filePath)) {
    try {
      datum = JSON.parse(fs.readFileSync(filePath));
    } catch {
      console.warn(`❌ Invalid JSON in datum file, resetting: ${filePath}`);
    }
  }

  // Overwrite or initialize with correct structure
  datum.phone_hash = blake2b224Hex(phone);
  datum.biometric_hash = blake2b224Hex(biometric);
  datum.passkey_hash = blake2b224Hex(passkey);
  datum.wallet_address = wallet;
  datum.created_at = createdAt;

  fs.writeFileSync(filePath, JSON.stringify(datum, null, 2));
  console.log(`✅ Updated datum: ${path.basename(filePath)}`);
}

// Ensure correct structure and update Redeemer JSON
function updateRedeemer(filePath, phone) {
  const hashedPhone = blake2b224Hex(phone);
  let redeemer = {};

  // Try to load and validate existing redeemer
  if (fs.existsSync(filePath)) {
    try {
      redeemer = JSON.parse(fs.readFileSync(filePath));
    } catch {
      console.warn(`❌ Invalid JSON in redeemer file, resetting: ${filePath}`);
    }
  }

  // Determine type by filename
  const filename = path.basename(filePath);

  if (filename.includes('store')) {
    redeemer = { StoreIdentity: { phone_hash: hashedPhone } };
  } else if (filename.includes('refund')) {
    redeemer = { Refund: { phone_hash: hashedPhone } };
  } else if (filename.includes('delete')) {
    redeemer = { Delete: { phone_hash: hashedPhone } };
  } else if (filename.includes('zk')) {
    redeemer = { ZKVerify: { phone_hash: hashedPhone } };
  } else {
    console.warn(`⚠️ Unknown redeemer type: ${filename}`);
    return;
  }

  fs.writeFileSync(filePath, JSON.stringify(redeemer, null, 2));
  console.log(`✅ Updated redeemer: ${filename}`);
}

// --- User Inputs (pass via CLI or use defaults) ---
const args = process.argv.slice(2);
const phone = args[0] || "+1234567890";
const biometric = args[1] || "biometric_sample_data";
const passkey = args[2] || "securePass2025!";
const wallet = args[3] || "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
const createdAt = parseInt(args[4]) || Math.floor(Date.now() / 1000);

// --- Files ---
const baseDir = path.join(__dirname, 'smart_contract_validator/lib/data/identity');


const datumFiles = [
  'signup_datum.json',
  'refund_datum.json',
  'delete_datum.json'
];

const redeemerFiles = [
  'store_identity_redeemer.json',
  'refund_redeemer.json',
  'delete_redeemer.json',
  'zk_verify_redeemer.json'
];

// --- Run updates ---
datumFiles.forEach(file => {
  updateDatum(path.join(baseDir, file), phone, biometric, passkey, wallet, createdAt);
});

redeemerFiles.forEach(file => {
  updateRedeemer(path.join(baseDir, file), phone);
});
