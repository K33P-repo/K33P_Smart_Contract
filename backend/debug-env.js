// Debug environment variables
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

console.log('Current working directory:', process.cwd());

// Get current file directory with ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load .env file
const envPath = path.resolve(process.cwd(), '.env');
console.log('Looking for .env file at:', envPath);

if (fs.existsSync(envPath)) {
  console.log('.env file exists');
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('.env file content (first 100 chars):', envContent.substring(0, 100));
  
  // Load .env file
  const result = dotenv.config();
  if (result.error) {
    console.error('Error loading .env file:', result.error);
  } else {
    console.log('.env file loaded successfully');
  }
} else {
  console.log('.env file does not exist');
}

// Print all environment variables
console.log('\nAll environment variables:');
Object.keys(process.env).forEach(key => {
  // Don't print the actual values of sensitive keys
  const isSensitive = key.includes('KEY') || key.includes('SECRET') || key.includes('PASSWORD');
  const value = isSensitive ? '[REDACTED]' : process.env[key];
  console.log(`${key}: ${value}`);
});

// Specifically check for IAGON variables
console.log('\nSpecifically checking IAGON variables:');
console.log('IAGON_API_URL:', process.env.IAGON_API_URL);
console.log('IAGON_API_KEY:', process.env.IAGON_API_KEY ? '[REDACTED]' : undefined);