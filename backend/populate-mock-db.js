// Script to populate the mock database for testing
import fs from 'fs';
import path from 'path';

// Read the user-deposits.json file
// Use an absolute path to ensure we find the file
const userDepositsPath = 'c:\\Users\\USER\\Desktop\\K33P_Smart_Contract\\backend\\user-deposits.json';
console.log('Looking for user deposits at:', userDepositsPath);
const userDeposits = JSON.parse(fs.readFileSync(userDepositsPath, 'utf8'));

// Create a mock database structure
const mockDb = {
  users: [],
  sessions: [],
  scriptUtxos: []
};

// Convert user deposits to mock users
userDeposits.forEach(deposit => {
  const user = {
    walletAddress: deposit.userAddress,
    userId: deposit.userId,
    phoneHash: deposit.phoneHash,
    zkCommitment: deposit.zkCommitment || '0000000000000000000000000000000000000000000000000000000-68c0687',
    createdAt: deposit.timestamp
  };
  
  mockDb.users.push(user);
});

// Write the mock database to a file
const mockDbPath = 'c:\\Users\\USER\\Desktop\\K33P_Smart_Contract\\backend\\src\\utils\\mock-db.json';

// Ensure the directory exists
const mockDbDir = path.dirname(mockDbPath);
if (!fs.existsSync(mockDbDir)) {
  console.log(`Creating directory: ${mockDbDir}`);
  fs.mkdirSync(mockDbDir, { recursive: true });
}

fs.writeFileSync(mockDbPath, JSON.stringify(mockDb, null, 2));

console.log(`Mock database populated with ${mockDb.users.length} users`);
console.log(`Mock database written to ${mockDbPath}`);