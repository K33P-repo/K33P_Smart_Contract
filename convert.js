const fs = require('fs');

const data = JSON.parse(fs.readFileSync('plutus.json', 'utf8'));
const cborHex = data.cborHex;

// Convert hex string to binary buffer
const binary = Buffer.from(cborHex, 'hex');
fs.writeFileSync('contract.plutus', binary);
console.log('✅ Plutus binary written to contract.plutus');
