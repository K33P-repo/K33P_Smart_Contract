// generate-salt.js
import crypto from 'crypto';

// Generate a secure random salt (32 bytes = 64 hex characters)
const salt = crypto.randomBytes(32).toString('hex');

console.log('Generated PHONE_HASH_SALT:');
console.log(salt);

// Also generate a shorter version if preferred
const shortSalt = crypto.randomBytes(16).toString('hex');
console.log('\nShorter version (32 hex characters):');
console.log(shortSalt);

// Generate a UUID-based salt
const uuidSalt = crypto.randomUUID().replace(/-/g, '');
console.log('\nUUID-based salt:');
console.log(uuidSalt);