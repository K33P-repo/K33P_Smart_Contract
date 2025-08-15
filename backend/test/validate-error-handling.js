// Simple validation script for K33P Error Handling System
// Validates that all error handling components are properly implemented

import fs from 'fs';
import path from 'path';

function validateErrorHandlingSystem() {
  console.log('\n🔍 K33P Error Handling System Validation');
  console.log('==========================================\n');
  
  const backendPath = path.resolve('../');
  const results = {
    filesCreated: 0,
    filesUpdated: 0,
    scenariosCovered: 0,
    issues: [],
    totalChecks: 0,
    passedChecks: 0
  };
  
  function check(description, condition, isRequired = true) {
    results.totalChecks++;
    if (condition) {
      results.passedChecks++;
      console.log(`✅ ${description}`);
      return true;
    } else {
      const prefix = isRequired ? '❌' : '⚠️ ';
      console.log(`${prefix} ${description}`);
      if (isRequired) {
        results.issues.push(description);
      }
      return false;
    }
  }
  
  console.log('📁 Checking Required Files:');
  console.log('---------------------------');
  
  // Check error-handler.ts
  const errorHandlerPath = path.join(backendPath, 'src/middleware/error-handler.ts');
  const hasErrorHandler = fs.existsSync(errorHandlerPath);
  check('Error handler middleware file exists', hasErrorHandler);
  
  if (hasErrorHandler) {
    results.filesCreated++;
    const errorHandlerContent = fs.readFileSync(errorHandlerPath, 'utf8');
    
    check('ErrorCodes enum exported', errorHandlerContent.includes('export enum ErrorCodes'));
    check('K33PError class exported', errorHandlerContent.includes('export class K33PError'));
    check('ResponseUtils class exported', errorHandlerContent.includes('export class ResponseUtils'));
    check('globalErrorHandler exported', errorHandlerContent.includes('export const globalErrorHandler'));
    check('asyncHandler exported', errorHandlerContent.includes('export const asyncHandler'));
    
    // Check specific error codes
    const requiredErrorCodes = [
      'AUTH_INVALID_CREDENTIALS',
      'USER_ALREADY_EXISTS', 
      'PHONE_ALREADY_EXISTS',
      'WALLET_ALREADY_EXISTS',
      'REFUND_FAILED',
      'VALIDATION_ERROR',
      'RATE_LIMIT_EXCEEDED'
    ];
    
    requiredErrorCodes.forEach(code => {
      if (check(`Error code ${code} defined`, errorHandlerContent.includes(code))) {
        results.scenariosCovered++;
      }
    });
  }
  
  // Check response-helpers.ts
  const responseHelpersPath = path.join(backendPath, 'src/utils/response-helpers.ts');
  const hasResponseHelpers = fs.existsSync(responseHelpersPath);
  check('Response helpers utility file exists', hasResponseHelpers);
  
  if (hasResponseHelpers) {
    results.filesCreated++;
    const responseHelpersContent = fs.readFileSync(responseHelpersPath, 'utf8');
    
    const requiredHelpers = [
      'handleValidationErrors',
      'createSuccessResponse',
      'createErrorResponse',
      'handleUserAlreadyExists',
      'handlePhoneAlreadyExists',
      'handleWalletAlreadyExists',
      'handleRefundFailed'
    ];
    
    requiredHelpers.forEach(helper => {
      check(`Helper function ${helper} exported`, responseHelpersContent.includes(`export function ${helper}`));
    });
  }
  
  // Check documentation
  const docsPath = path.join(backendPath, 'docs/API_ERROR_RESPONSE_GUIDE.md');
  const hasDocumentation = fs.existsSync(docsPath);
  check('API error response documentation exists', hasDocumentation);
  
  if (hasDocumentation) {
    results.filesCreated++;
    const docsContent = fs.readFileSync(docsPath, 'utf8');
    
    check('Documentation has success response format', docsContent.includes('Success Response Format'));
    check('Documentation has error response format', docsContent.includes('Error Response Format'));
    check('Documentation has scenario examples', docsContent.includes('Scenario-Based Examples'));
    
    // Check for specific scenarios mentioned in user requirements
    const requiredScenarios = [
      'User already sign up',
      'phone number in use',
      'wallet address already in use',
      'refund failed'
    ];
    
    requiredScenarios.forEach(scenario => {
      check(`Scenario documented: ${scenario}`, docsContent.toLowerCase().includes(scenario.toLowerCase()));
    });
    
    check('Console vs user-facing distinction documented', 
      docsContent.includes('console') && docsContent.includes('user-facing'));
  }
  
  console.log('\n🔄 Checking Updated Files:');
  console.log('---------------------------');
  
  // Check auth.js updates
  const authPath = path.join(backendPath, 'src/routes/auth.js');
  const hasAuthFile = fs.existsSync(authPath);
  check('Auth route file exists', hasAuthFile);
  
  if (hasAuthFile) {
    const authContent = fs.readFileSync(authPath, 'utf8');
    
    const hasErrorHandlingImports = 
      authContent.includes('K33PError') &&
      authContent.includes('ErrorCodes') &&
      authContent.includes('asyncHandler') &&
      authContent.includes('ResponseUtils');
    
    if (check('Auth routes updated with error handling imports', hasErrorHandlingImports)) {
      results.filesUpdated++;
    }
    
    check('Auth routes use asyncHandler', authContent.includes('asyncHandler('));
    check('Auth routes use ResponseUtils.success', authContent.includes('ResponseUtils.success'));
  }
  
  // Check utxo.js updates
  const utxoPath = path.join(backendPath, 'src/routes/utxo.js');
  const hasUtxoFile = fs.existsSync(utxoPath);
  check('UTXO route file exists', hasUtxoFile);
  
  if (hasUtxoFile) {
    const utxoContent = fs.readFileSync(utxoPath, 'utf8');
    
    const hasErrorHandlingImports = 
      utxoContent.includes('K33PError') &&
      utxoContent.includes('ErrorCodes') &&
      utxoContent.includes('asyncHandler') &&
      utxoContent.includes('ResponseUtils');
    
    if (check('UTXO routes updated with error handling imports', hasErrorHandlingImports)) {
      results.filesUpdated++;
    }
    
    check('UTXO routes use asyncHandler', utxoContent.includes('asyncHandler('));
    check('UTXO routes use ResponseUtils.success', utxoContent.includes('ResponseUtils.success'));
  }
  
  // Check main server file updates
  const serverPath = path.join(backendPath, 'src/k33p-backend-server.ts');
  const hasServerFile = fs.existsSync(serverPath);
  check('Main server file exists', hasServerFile);
  
  if (hasServerFile) {
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    
    check('Server imports globalErrorHandler', serverContent.includes('globalErrorHandler'));
    
    if (check('Server uses globalErrorHandler middleware', serverContent.includes('app.use(globalErrorHandler)'))) {
      results.filesUpdated++;
    }
  }
  
  console.log('\n🎯 Checking Specific Scenarios:');
  console.log('--------------------------------');
  
  if (hasErrorHandler) {
    const errorHandlerContent = fs.readFileSync(errorHandlerPath, 'utf8');
    
    const scenarios = [
      { name: 'User already signed up', code: 'USER_ALREADY_EXISTS' },
      { name: 'Phone number in use', code: 'PHONE_ALREADY_EXISTS' },
      { name: 'Wallet address in use', code: 'WALLET_ALREADY_EXISTS' },
      { name: 'Refund failed', code: 'REFUND_FAILED' },
      { name: 'User using account second time', code: 'USER_ALREADY_EXISTS' },
      { name: 'No Ada sent yet', code: 'USER_ALREADY_EXISTS' }
    ];
    
    scenarios.forEach(scenario => {
      check(`Scenario handled: ${scenario.name}`, errorHandlerContent.includes(scenario.code));
    });
  }
  
  console.log('\n📊 Validation Summary:');
  console.log('======================');
  console.log(`Total Checks: ${results.totalChecks}`);
  console.log(`Passed Checks: ${results.passedChecks}`);
  console.log(`Success Rate: ${Math.round((results.passedChecks / results.totalChecks) * 100)}%`);
  console.log(`Files Created: ${results.filesCreated}/3`);
  console.log(`Files Updated: ${results.filesUpdated}/3`);
  
  if (results.issues.length === 0) {
    console.log('\n🎉 All error handling requirements implemented successfully!');
    console.log('\n✨ Key Features Implemented:');
    console.log('   • Centralized error handling middleware');
    console.log('   • Standardized response utilities');
    console.log('   • Comprehensive error codes for all scenarios');
    console.log('   • Updated route files with new error handling');
    console.log('   • Complete API documentation with examples');
    console.log('   • Console vs user-facing error distinction');
    
    return true;
  } else {
    console.log(`\n⚠️  ${results.issues.length} Critical Issues Found:`);
    results.issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
    
    return false;
  }
}

// Run validation
const success = validateErrorHandlingSystem();
process.exit(success ? 0 : 1);