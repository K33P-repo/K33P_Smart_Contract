const fs = require('fs');
const path = require('path');

// Target directory inside your project root
const outputDir = path.join(__dirname, 'smart_contract', 'data', 'identity');

// Ensure the directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Sample AuthData (28 bytes hash example)
const sampleAuthData = {
  phone_hash: "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"
};

// Datum JSON structure
const datum = {
  version: 1,
  auth_data: sampleAuthData,
  is_active: true
};

// Redeemer JSON structures
const redeemers = {
  StoreAuthData: { StoreAuthData: sampleAuthData },
  UpdateAuthData: { UpdateAuthData: sampleAuthData },
  DeleteAuthData: "DeleteAuthData"
};

// Write datum JSON file
fs.writeFileSync(
  path.join(outputDir, 'auth_datum.json'),
  JSON.stringify(datum, null, 2)
);

// Write redeemer JSON files
for (const [name, content] of Object.entries(redeemers)) {
  const filename = `${name.toLowerCase()}_redeemer.json`;
  fs.writeFileSync(
    path.join(outputDir, filename),
    JSON.stringify(content, null, 2)
  );
}

console.log('Placeholder datum and redeemer JSON files created in /smart_contract/data/placeholder/');
