import newman from 'newman';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DEPLOYED_SERVER_URL = 'https://k33p-backend-0kyx.onrender.com';
const COLLECTION_PATH = path.join(__dirname, 'test-deployed-endpoints.json');
const RESULTS_PATH = path.join(__dirname, 'test-results.json');

// Test results storage
let testResults = {
  timestamp: new Date().toISOString(),
  serverUrl: DEPLOYED_SERVER_URL,
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  errors: [],
  endpoints: []
};

console.log('🚀 Starting K33P Backend API Tests on Deployed Server');
console.log(`📡 Server URL: ${DEPLOYED_SERVER_URL}`);
console.log('=' .repeat(60));

// Run Newman collection
newman.run({
  collection: COLLECTION_PATH,
  environment: {
    values: [
      {
        key: 'baseUrl',
        value: DEPLOYED_SERVER_URL,
        enabled: true
      }
    ]
  },
  reporters: ['cli', 'json'],
  reporter: {
    json: {
      export: RESULTS_PATH
    }
  },
  timeout: 30000, // 30 second timeout
  delayRequest: 1000, // 1 second delay between requests
  bail: false // Continue on failures
}, function (err, summary) {
  if (err) {
    console.error('❌ Newman run failed:', err);
    process.exit(1);
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(60));

  // Process results
  testResults.totalTests = summary.run.stats.requests.total;
  testResults.passedTests = summary.run.stats.requests.total - summary.run.stats.requests.failed;
  testResults.failedTests = summary.run.stats.requests.failed;

  console.log(`Total Requests: ${testResults.totalTests}`);
  console.log(`Passed: ${testResults.passedTests}`);
  console.log(`Failed: ${testResults.failedTests}`);
  console.log(`Success Rate: ${((testResults.passedTests / testResults.totalTests) * 100).toFixed(2)}%`);

  // Analyze failures
  if (summary.run.failures && summary.run.failures.length > 0) {
    console.log('\n❌ FAILED REQUESTS:');
    console.log('-' .repeat(40));
    
    summary.run.failures.forEach((failure, index) => {
      const error = {
        endpoint: failure.source?.name || 'Unknown',
        method: failure.source?.request?.method || 'Unknown',
        url: failure.source?.request?.url?.raw || 'Unknown',
        error: failure.error?.message || 'Unknown error',
        statusCode: failure.error?.code || 'Unknown'
      };
      
      testResults.errors.push(error);
      
      console.log(`${index + 1}. ${error.endpoint}`);
      console.log(`   Method: ${error.method}`);
      console.log(`   URL: ${error.url}`);
      console.log(`   Error: ${error.error}`);
      console.log(`   Status: ${error.statusCode}`);
      console.log('');
    });
  }

  // Analyze successful requests
  if (summary.run.executions && summary.run.executions.length > 0) {
    console.log('\n✅ ENDPOINT STATUS:');
    console.log('-' .repeat(40));
    
    summary.run.executions.forEach((execution) => {
      const endpoint = {
        name: execution.item?.name || 'Unknown',
        method: execution.request?.method || 'Unknown',
        url: execution.request?.url?.toString() || 'Unknown',
        status: execution.response?.code || 'No Response',
        responseTime: execution.response?.responseTime || 0,
        success: !execution.requestError
      };
      
      testResults.endpoints.push(endpoint);
      
      const statusIcon = endpoint.success ? '✅' : '❌';
      const statusCode = endpoint.status;
      const responseTime = endpoint.responseTime;
      
      console.log(`${statusIcon} ${endpoint.name}`);
      console.log(`   ${endpoint.method} ${endpoint.url}`);
      console.log(`   Status: ${statusCode} | Response Time: ${responseTime}ms`);
      
      if (!endpoint.success && execution.requestError) {
        console.log(`   Error: ${execution.requestError.message}`);
      }
      console.log('');
    });
  }

  // Save detailed results
  fs.writeFileSync(
    path.join(__dirname, 'detailed-test-results.json'),
    JSON.stringify(testResults, null, 2)
  );

  // Generate recommendations
  console.log('\n🔧 RECOMMENDATIONS:');
  console.log('-' .repeat(40));
  
  const errorTypes = {};
  testResults.errors.forEach(error => {
    const errorType = error.error.toLowerCase();
    if (errorType.includes('timeout')) {
      errorTypes.timeout = (errorTypes.timeout || 0) + 1;
    } else if (errorType.includes('connection')) {
      errorTypes.connection = (errorTypes.connection || 0) + 1;
    } else if (errorType.includes('404')) {
      errorTypes.notFound = (errorTypes.notFound || 0) + 1;
    } else if (errorType.includes('500')) {
      errorTypes.serverError = (errorTypes.serverError || 0) + 1;
    } else if (errorType.includes('require')) {
      errorTypes.requireError = (errorTypes.requireError || 0) + 1;
    }
  });

  if (errorTypes.requireError) {
    console.log('• Fix "require is not defined" errors by converting CommonJS to ES modules');
  }
  if (errorTypes.timeout) {
    console.log('• Increase server timeout settings for slow endpoints');
  }
  if (errorTypes.connection) {
    console.log('• Check server connectivity and network configuration');
  }
  if (errorTypes.notFound) {
    console.log('• Verify endpoint routes are properly configured');
  }
  if (errorTypes.serverError) {
    console.log('• Check server logs for internal errors and fix application bugs');
  }

  console.log('\n📄 Detailed results saved to: detailed-test-results.json');
  console.log('\n🏁 Testing completed!');
  
  // Exit with appropriate code
  process.exit(testResults.failedTests > 0 ? 1 : 0);
});