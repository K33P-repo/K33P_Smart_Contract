const fs = require('fs');

// Read the server file
let serverContent = fs.readFileSync('src/k33p-backend-server.ts', 'utf8');

// Find the k33pManager initialization and wrap it with condition
const initPattern = /await k33pManager\.initialize\(\);/;

if (initPattern.test(serverContent)) {
  const replacement = `if (process.env.DISABLE_CARDANO !== 'true') {
    await k33pManager.initialize();
  } else {
    console.log('🚫 Cardano features disabled via DISABLE_CARDANO');
  }`;
  
  serverContent = serverContent.replace(initPattern, replacement);
  fs.writeFileSync('src/k33p-backend-server.ts', serverContent);
  console.log('✅ Successfully patched server file to respect DISABLE_CARDANO');
} else {
  console.log('❌ Could not find the k33pManager initialization line');
}
