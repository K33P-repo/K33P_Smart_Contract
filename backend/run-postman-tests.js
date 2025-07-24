#!/usr/bin/env node

/**
 * K33P Backend API Testing with Postman CLI
 * Uses the provided Postman API key to run comprehensive API tests
 * 
 * Prerequisites:
 * - Postman CLI installed (newman)
 * - Server running on localhost:3001
 * 
 * Usage: node run-postman-tests.js
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Configuration
const POSTMAN_API_KEY = process.env.POSTMAN_API_KEY || 'YOUR_POSTMAN_API_KEY_HERE';
const COLLECTION_FILE = 'k33p-api-collection.json';
const BASE_URL = 'http://localhost:3001';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Check if collection file exists
function checkCollectionFile() {
  if (!fs.existsSync(COLLECTION_FILE)) {
    console.log(`${colors.red}❌ Collection file not found: ${COLLECTION_FILE}${colors.reset}`);
    console.log(`${colors.yellow}Please ensure the collection file is in the current directory.${colors.reset}`);
    return false;
  }
  return true;
}

// Check if server is running
async function checkServerHealth() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    return response.ok;
  } catch (error) {
    console.log(`${colors.red}❌ Server is not running at ${BASE_URL}${colors.reset}`);
    console.log(`${colors.yellow}Please start the server first: npm start${colors.reset}`);
    return false;
  }
}

// Check if newman (Postman CLI) is installed
function checkNewmanInstalled() {
  return new Promise((resolve) => {
    const newman = spawn('newman', ['--version'], { shell: true });
    
    newman.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        console.log(`${colors.red}❌ Newman (Postman CLI) is not installed${colors.reset}`);
        console.log(`${colors.yellow}Install it with: npm install -g newman${colors.reset}`);
        resolve(false);
      }
    });
    
    newman.on('error', () => {
      console.log(`${colors.red}❌ Newman (Postman CLI) is not installed${colors.reset}`);
      console.log(`${colors.yellow}Install it with: npm install -g newman${colors.reset}`);
      resolve(false);
    });
  });
}

// Run newman with the collection
function runNewmanTests() {
  return new Promise((resolve, reject) => {
    console.log(`${colors.blue}🚀 Running Postman Collection Tests...${colors.reset}`);
    console.log(`${colors.blue}Collection: ${COLLECTION_FILE}${colors.reset}`);
    console.log(`${colors.blue}Base URL: ${BASE_URL}${colors.reset}`);
    console.log('='.repeat(60));
    
    const newman = spawn('newman', [
      'run',
      COLLECTION_FILE,
      '--reporters', 'cli,json',
      '--reporter-json-export', 'newman-results.json',
      '--global-var', `baseUrl=${BASE_URL}`,
      '--global-var', `apiKey=${POSTMAN_API_KEY}`,
      '--timeout', '10000',
      '--delay-request', '500'
    ], { 
      shell: true,
      stdio: 'inherit'
    });
    
    newman.on('close', (code) => {
      console.log('='.repeat(60));
      if (code === 0) {
        console.log(`${colors.green}✅ All tests completed successfully!${colors.reset}`);
        
        // Try to read and display summary from JSON report
        try {
          if (fs.existsSync('newman-results.json')) {
            const results = JSON.parse(fs.readFileSync('newman-results.json', 'utf8'));
            const summary = results.run.stats;
            
            console.log(`\n${colors.bold}📊 Test Summary:${colors.reset}`);
            console.log(`${colors.green}✅ Requests: ${summary.requests.total}${colors.reset}`);
            console.log(`${colors.green}✅ Assertions: ${summary.assertions.total}${colors.reset}`);
            
            if (summary.assertions.failed > 0) {
              console.log(`${colors.red}❌ Failed Assertions: ${summary.assertions.failed}${colors.reset}`);
            }
            
            if (summary.requests.failed > 0) {
              console.log(`${colors.red}❌ Failed Requests: ${summary.requests.failed}${colors.reset}`);
            }
          }
        } catch (error) {
          console.log(`${colors.yellow}⚠️  Could not read detailed results${colors.reset}`);
        }
        
        resolve(true);
      } else {
        console.log(`${colors.red}❌ Tests failed with exit code: ${code}${colors.reset}`);
        resolve(false);
      }
    });
    
    newman.on('error', (error) => {
      console.log(`${colors.red}❌ Error running tests: ${error.message}${colors.reset}`);
      reject(error);
    });
  });
}

// Alternative: Run with curl if newman is not available
async function runCurlTests() {
  console.log(`${colors.yellow}📋 Running basic tests with curl...${colors.reset}`);
  
  const tests = [
    {
      name: 'Health Check',
      command: `curl -s -w "\nStatus: %{http_code}\nTime: %{time_total}s\n" "${BASE_URL}/api/health"`
    },
    {
      name: 'API Status',
      command: `curl -s -w "\nStatus: %{http_code}\nTime: %{time_total}s\n" "${BASE_URL}/api/status"`
    },
    {
      name: 'Signup Test',
      command: `curl -s -w "\nStatus: %{http_code}\nTime: %{time_total}s\n" -X POST -H "Content-Type: application/json" -d "{\"test\":\"data\"}" "${BASE_URL}/api/auth/signup-test"`
    }
  ];
  
  for (const test of tests) {
    console.log(`\n${colors.blue}Testing: ${test.name}${colors.reset}`);
    console.log('-'.repeat(40));
    
    try {
      const result = await new Promise((resolve, reject) => {
        const curl = spawn('curl', test.command.split(' ').slice(1), { shell: true });
        let output = '';
        
        curl.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        curl.on('close', (code) => {
          resolve({ code, output });
        });
        
        curl.on('error', reject);
      });
      
      console.log(result.output);
    } catch (error) {
      console.log(`${colors.red}❌ Test failed: ${error.message}${colors.reset}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Main execution
async function main() {
  console.log(`${colors.bold}${colors.blue}🧪 K33P Backend API Testing Suite${colors.reset}`);
  console.log(`${colors.blue}Using Postman CLI with API Key: ${POSTMAN_API_KEY.substring(0, 20)}...${colors.reset}\n`);
  
  // Check prerequisites
  if (!checkCollectionFile()) {
    process.exit(1);
  }
  
  console.log(`${colors.blue}Checking server health...${colors.reset}`);
  const serverHealthy = await checkServerHealth();
  
  if (!serverHealthy) {
    process.exit(1);
  }
  
  console.log(`${colors.green}✅ Server is running${colors.reset}`);
  
  // Check if newman is installed
  console.log(`${colors.blue}Checking Newman installation...${colors.reset}`);
  const newmanInstalled = await checkNewmanInstalled();
  
  if (newmanInstalled) {
    console.log(`${colors.green}✅ Newman is installed${colors.reset}`);
    await runNewmanTests();
  } else {
    console.log(`${colors.yellow}⚠️  Newman not found, falling back to curl tests${colors.reset}`);
    await runCurlTests();
  }
}

// Run the main function
main().catch(error => {
  console.error(`${colors.red}❌ Unexpected error: ${error.message}${colors.reset}`);
  process.exit(1);
});