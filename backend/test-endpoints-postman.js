#!/usr/bin/env node

/**
 * K33P Backend API Endpoint Testing with Postman CLI
 * Comprehensive testing script for all K33P API endpoints
 * 
 * Prerequisites:
 * - Postman CLI installed (newman)
 * - Server running on localhost:3001
 * - Valid Postman API key
 * 
 * Usage: node test-endpoints-postman.js
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Configuration
const POSTMAN_API_KEY = process.env.POSTMAN_API_KEY || 'YOUR_POSTMAN_API_KEY_HERE';
const COLLECTION_FILE = 'k33p-api-collection.json';
const BASE_URL = 'http://localhost:3001';
const RESULTS_DIR = 'test-results';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

// Test configuration
const testConfig = {
  timeout: 15000,
  delayRequest: 1000,
  iterations: 1,
  reporters: ['cli', 'json', 'htmlextra'],
  verbose: true
};

// Ensure results directory exists
function ensureResultsDir() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    console.log(`${colors.blue}📁 Created results directory: ${RESULTS_DIR}${colors.reset}`);
  }
}

// Check server health with detailed response
async function checkServerHealth() {
  console.log(`${colors.blue}🏥 Checking server health...${colors.reset}`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(`${BASE_URL}/api/health`);
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      console.log(`${colors.green}✅ Server is healthy${colors.reset}`);
      console.log(`${colors.dim}   Response time: ${responseTime}ms${colors.reset}`);
      console.log(`${colors.dim}   Status: ${data.status || 'OK'}${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}❌ Server returned status: ${response.status}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}❌ Server is not accessible: ${error.message}${colors.reset}`);
    console.log(`${colors.yellow}💡 Make sure the server is running: npm start${colors.reset}`);
    return false;
  }
}

// Validate Postman API key format
function validateApiKey() {
  if (!POSTMAN_API_KEY || POSTMAN_API_KEY === 'YOUR_POSTMAN_API_KEY_HERE') {
    console.log(`${colors.red}❌ Invalid Postman API key${colors.reset}`);
    console.log(`${colors.yellow}💡 Set POSTMAN_API_KEY environment variable${colors.reset}`);
    console.log(`${colors.dim}   Example: export POSTMAN_API_KEY=your_actual_key${colors.reset}`);
    return false;
  }
  
  // Basic format validation (Postman keys are typically 64 characters)
  if (POSTMAN_API_KEY.length < 20) {
    console.log(`${colors.yellow}⚠️  API key seems too short, but proceeding...${colors.reset}`);
  }
  
  console.log(`${colors.green}✅ API key validated${colors.reset}`);
  console.log(`${colors.dim}   Key: ${POSTMAN_API_KEY.substring(0, 8)}...${POSTMAN_API_KEY.substring(-4)}${colors.reset}`);
  return true;
}

// Run comprehensive tests with detailed reporting
function runComprehensiveTests() {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(RESULTS_DIR, `test-report-${timestamp}.json`);
    const htmlReportFile = path.join(RESULTS_DIR, `test-report-${timestamp}.html`);
    
    console.log(`${colors.magenta}🚀 Starting comprehensive API tests...${colors.reset}`);
    console.log(`${colors.blue}📋 Configuration:${colors.reset}`);
    console.log(`${colors.dim}   Collection: ${COLLECTION_FILE}${colors.reset}`);
    console.log(`${colors.dim}   Base URL: ${BASE_URL}${colors.reset}`);
    console.log(`${colors.dim}   Timeout: ${testConfig.timeout}ms${colors.reset}`);
    console.log(`${colors.dim}   Delay: ${testConfig.delayRequest}ms${colors.reset}`);
    console.log(`${colors.dim}   Reports: ${reportFile}${colors.reset}`);
    console.log('='.repeat(80));
    
    const newmanArgs = [
      'run', COLLECTION_FILE,
      '--reporters', testConfig.reporters.join(','),
      '--reporter-json-export', reportFile,
      '--reporter-htmlextra-export', htmlReportFile,
      '--reporter-htmlextra-title', 'K33P API Test Report',
      '--reporter-htmlextra-logs',
      '--global-var', `baseUrl=${BASE_URL}`,
      '--global-var', `apiKey=${POSTMAN_API_KEY}`,
      '--timeout', testConfig.timeout.toString(),
      '--delay-request', testConfig.delayRequest.toString(),
      '--iteration-count', testConfig.iterations.toString(),
      '--color', 'on'
    ];
    
    if (testConfig.verbose) {
      newmanArgs.push('--verbose');
    }
    
    const newman = spawn('newman', newmanArgs, {
      shell: true,
      stdio: 'inherit'
    });
    
    newman.on('close', (code) => {
      console.log('='.repeat(80));
      
      if (code === 0) {
        console.log(`${colors.green}🎉 All tests completed successfully!${colors.reset}`);
        displayTestSummary(reportFile);
        console.log(`${colors.cyan}📊 Detailed report: ${htmlReportFile}${colors.reset}`);
        resolve(true);
      } else {
        console.log(`${colors.red}❌ Tests failed with exit code: ${code}${colors.reset}`);
        displayTestSummary(reportFile);
        resolve(false);
      }
    });
    
    newman.on('error', (error) => {
      console.log(`${colors.red}❌ Error running tests: ${error.message}${colors.reset}`);
      reject(error);
    });
  });
}

// Display detailed test summary
function displayTestSummary(reportFile) {
  try {
    if (!fs.existsSync(reportFile)) {
      console.log(`${colors.yellow}⚠️  Report file not found: ${reportFile}${colors.reset}`);
      return;
    }
    
    const results = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    const run = results.run;
    const stats = run.stats;
    const timings = run.timings;
    
    console.log(`\n${colors.bold}📊 Detailed Test Summary:${colors.reset}`);
    console.log('─'.repeat(50));
    
    // Request statistics
    console.log(`${colors.blue}📡 Requests:${colors.reset}`);
    console.log(`   Total: ${stats.requests.total}`);
    console.log(`   ${colors.green}Passed: ${stats.requests.total - stats.requests.failed}${colors.reset}`);
    if (stats.requests.failed > 0) {
      console.log(`   ${colors.red}Failed: ${stats.requests.failed}${colors.reset}`);
    }
    
    // Assertion statistics
    console.log(`\n${colors.blue}✅ Assertions:${colors.reset}`);
    console.log(`   Total: ${stats.assertions.total}`);
    console.log(`   ${colors.green}Passed: ${stats.assertions.total - stats.assertions.failed}${colors.reset}`);
    if (stats.assertions.failed > 0) {
      console.log(`   ${colors.red}Failed: ${stats.assertions.failed}${colors.reset}`);
    }
    
    // Timing information
    if (timings) {
      console.log(`\n${colors.blue}⏱️  Timing:${colors.reset}`);
      console.log(`   Started: ${new Date(timings.started).toLocaleString()}`);
      console.log(`   Completed: ${new Date(timings.completed).toLocaleString()}`);
      console.log(`   Duration: ${((timings.completed - timings.started) / 1000).toFixed(2)}s`);
    }
    
    // Failed tests details
    if (run.failures && run.failures.length > 0) {
      console.log(`\n${colors.red}❌ Failed Tests:${colors.reset}`);
      run.failures.forEach((failure, index) => {
        console.log(`   ${index + 1}. ${failure.error.name}: ${failure.error.message}`);
        if (failure.source && failure.source.name) {
          console.log(`      Source: ${failure.source.name}`);
        }
      });
    }
    
    // Performance insights
    if (run.executions && run.executions.length > 0) {
      const avgResponseTime = run.executions.reduce((sum, exec) => {
        return sum + (exec.response ? exec.response.responseTime : 0);
      }, 0) / run.executions.length;
      
      console.log(`\n${colors.blue}🚀 Performance:${colors.reset}`);
      console.log(`   Average response time: ${avgResponseTime.toFixed(2)}ms`);
      
      const slowestRequest = run.executions.reduce((slowest, exec) => {
        const responseTime = exec.response ? exec.response.responseTime : 0;
        return responseTime > slowest.time ? { time: responseTime, name: exec.item.name } : slowest;
      }, { time: 0, name: '' });
      
      if (slowestRequest.time > 0) {
        console.log(`   Slowest request: ${slowestRequest.name} (${slowestRequest.time}ms)`);
      }
    }
    
  } catch (error) {
    console.log(`${colors.yellow}⚠️  Could not parse test results: ${error.message}${colors.reset}`);
  }
}

// Run basic endpoint checks if Newman is not available
async function runBasicEndpointChecks() {
  console.log(`${colors.yellow}🔧 Running basic endpoint checks...${colors.reset}`);
  
  const endpoints = [
    { name: 'Health Check', path: '/api/health', method: 'GET' },
    { name: 'API Status', path: '/api/status', method: 'GET' },
    { name: 'Auth Status', path: '/api/auth/status', method: 'GET' },
    { name: 'User Profile', path: '/api/user/profile', method: 'GET' },
    { name: 'Smart Contracts', path: '/api/contracts', method: 'GET' }
  ];
  
  let passedTests = 0;
  let totalTests = endpoints.length;
  
  for (const endpoint of endpoints) {
    console.log(`\n${colors.blue}Testing: ${endpoint.name}${colors.reset}`);
    console.log(`${colors.dim}${endpoint.method} ${BASE_URL}${endpoint.path}${colors.reset}`);
    console.log('-'.repeat(60));
    
    try {
      const startTime = Date.now();
      const response = await fetch(`${BASE_URL}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${POSTMAN_API_KEY}`
        }
      });
      const responseTime = Date.now() - startTime;
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      console.log(`Response time: ${responseTime}ms`);
      
      if (response.ok) {
        console.log(`${colors.green}✅ PASSED${colors.reset}`);
        passedTests++;
      } else {
        console.log(`${colors.yellow}⚠️  Non-200 status (may be expected)${colors.reset}`);
      }
      
    } catch (error) {
      console.log(`${colors.red}❌ FAILED: ${error.message}${colors.reset}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n${colors.bold}📊 Basic Tests Summary:${colors.reset}`);
  console.log(`${colors.green}Passed: ${passedTests}/${totalTests}${colors.reset}`);
  
  return passedTests === totalTests;
}

// Check if Newman is installed
function checkNewmanInstalled() {
  return new Promise((resolve) => {
    const newman = spawn('newman', ['--version'], { shell: true });
    
    newman.on('close', (code) => {
      resolve(code === 0);
    });
    
    newman.on('error', () => {
      resolve(false);
    });
  });
}

// Main execution function
async function main() {
  console.log(`${colors.bold}${colors.magenta}🧪 K33P Backend API Comprehensive Testing Suite${colors.reset}`);
  console.log(`${colors.dim}Testing all endpoints with Postman CLI integration${colors.reset}\n`);
  
  // Setup
  ensureResultsDir();
  
  // Validate prerequisites
  if (!validateApiKey()) {
    process.exit(1);
  }
  
  if (!fs.existsSync(COLLECTION_FILE)) {
    console.log(`${colors.red}❌ Collection file not found: ${COLLECTION_FILE}${colors.reset}`);
    console.log(`${colors.yellow}💡 Please ensure the Postman collection is in the current directory${colors.reset}`);
    process.exit(1);
  }
  
  const serverHealthy = await checkServerHealth();
  if (!serverHealthy) {
    process.exit(1);
  }
  
  // Check Newman installation
  console.log(`${colors.blue}🔍 Checking Newman installation...${colors.reset}`);
  const newmanInstalled = await checkNewmanInstalled();
  
  let testsPassed = false;
  
  if (newmanInstalled) {
    console.log(`${colors.green}✅ Newman is installed${colors.reset}`);
    testsPassed = await runComprehensiveTests();
  } else {
    console.log(`${colors.yellow}⚠️  Newman not found${colors.reset}`);
    console.log(`${colors.dim}   Install with: npm install -g newman newman-reporter-htmlextra${colors.reset}`);
    console.log(`${colors.yellow}🔄 Falling back to basic endpoint checks...${colors.reset}`);
    testsPassed = await runBasicEndpointChecks();
  }
  
  // Final summary
  console.log(`\n${'='.repeat(80)}`);
  if (testsPassed) {
    console.log(`${colors.green}🎉 All tests completed successfully!${colors.reset}`);
    console.log(`${colors.green}✅ K33P Backend API is functioning correctly${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ Some tests failed${colors.reset}`);
    console.log(`${colors.yellow}💡 Check the detailed reports for more information${colors.reset}`);
  }
  
  process.exit(testsPassed ? 0 : 1);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error(`${colors.red}❌ Unhandled error: ${error.message}${colors.reset}`);
  process.exit(1);
});

// Run the main function
main().catch(error => {
  console.error(`${colors.red}❌ Unexpected error: ${error.message}${colors.reset}`);
  process.exit(1);
});