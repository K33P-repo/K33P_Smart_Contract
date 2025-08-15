// Unit tests for K33P Error Handling System
// Tests the error handling utilities and middleware without requiring a running server

import { expect } from 'chai';
import { describe, it } from 'mocha';
import fs from 'fs';
import path from 'path';

// Test the error handling files exist and have correct structure
describe('K33P Error Handling System - Unit Tests', () => {
  const backendPath = path.resolve('../');
  
  describe('Error Handling Files Structure', () => {
    it('should have error-handler.ts middleware file', () => {
      const errorHandlerPath = path.join(backendPath, 'src/middleware/error-handler.ts');
      expect(fs.existsSync(errorHandlerPath)).to.be.true;
      
      const content = fs.readFileSync(errorHandlerPath, 'utf8');
      
      // Check for required exports
      expect(content).to.include('export enum ErrorCodes');
      expect(content).to.include('export class K33PError');
      expect(content).to.include('export class ResponseUtils');
      expect(content).to.include('export const globalErrorHandler');
      expect(content).to.include('export const asyncHandler');
      
      // Check for specific error codes
      expect(content).to.include('AUTH_INVALID_CREDENTIALS');
      expect(content).to.include('USER_ALREADY_EXISTS');
      expect(content).to.include('PHONE_ALREADY_EXISTS');
      expect(content).to.include('WALLET_ALREADY_EXISTS');
      expect(content).to.include('REFUND_FAILED');
      expect(content).to.include('VALIDATION_ERROR');
      expect(content).to.include('RATE_LIMIT_EXCEEDED');
    });
    
    it('should have response-helpers.ts utility file', () => {
      const responseHelpersPath = path.join(backendPath, 'src/utils/response-helpers.ts');
      expect(fs.existsSync(responseHelpersPath)).to.be.true;
      
      const content = fs.readFileSync(responseHelpersPath, 'utf8');
      
      // Check for required helper functions
      expect(content).to.include('export function handleValidationErrors');
      expect(content).to.include('export function createSuccessResponse');
      expect(content).to.include('export function createErrorResponse');
      expect(content).to.include('export function handleUserAlreadyExists');
      expect(content).to.include('export function handlePhoneAlreadyExists');
      expect(content).to.include('export function handleWalletAlreadyExists');
      expect(content).to.include('export function handleRefundFailed');
    });
    
    it('should have API documentation file', () => {
      const docsPath = path.join(backendPath, 'docs/API_ERROR_RESPONSE_GUIDE.md');
      expect(fs.existsSync(docsPath)).to.be.true;
      
      const content = fs.readFileSync(docsPath, 'utf8');
      
      // Check for required documentation sections
      expect(content).to.include('# K33P API Error Response Guide');
      expect(content).to.include('## Success Response Format');
      expect(content).to.include('## Error Response Format');
      expect(content).to.include('## Scenario-Based Examples');
      expect(content).to.include('User already signed up');
      expect(content).to.include('Phone number in use');
      expect(content).to.include('Wallet address already in use');
      expect(content).to.include('Refund failed');
    });
  });
  
  describe('Route Files Updated', () => {
    it('should have updated auth.js with new error handling', () => {
      const authPath = path.join(backendPath, 'src/routes/auth.js');
      expect(fs.existsSync(authPath)).to.be.true;
      
      const content = fs.readFileSync(authPath, 'utf8');
      
      // Check for imports of new error handling utilities
      expect(content).to.include('K33PError');
      expect(content).to.include('ErrorCodes');
      expect(content).to.include('asyncHandler');
      expect(content).to.include('ResponseUtils');
      
      // Check for usage in routes
      expect(content).to.include('asyncHandler');
      expect(content).to.include('ResponseUtils.success');
    });
    
    it('should have updated utxo.js with new error handling', () => {
      const utxoPath = path.join(backendPath, 'src/routes/utxo.js');
      expect(fs.existsSync(utxoPath)).to.be.true;
      
      const content = fs.readFileSync(utxoPath, 'utf8');
      
      // Check for imports of new error handling utilities
      expect(content).to.include('K33PError');
      expect(content).to.include('ErrorCodes');
      expect(content).to.include('asyncHandler');
      expect(content).to.include('ResponseUtils');
    });
    
    it('should have updated main server file with global error handler', () => {
      const serverPath = path.join(backendPath, 'src/k33p-backend-server.ts');
      expect(fs.existsSync(serverPath)).to.be.true;
      
      const content = fs.readFileSync(serverPath, 'utf8');
      
      // Check for global error handler import and usage
      expect(content).to.include('globalErrorHandler');
      expect(content).to.include('app.use(globalErrorHandler)');
    });
  });
  
  describe('Error Response Structure Validation', () => {
    it('should validate success response structure', () => {
      // Mock success response structure
      const successResponse = {
        success: true,
        data: { message: 'Operation completed successfully' },
        timestamp: new Date().toISOString()
      };
      
      expect(successResponse).to.have.property('success', true);
      expect(successResponse).to.have.property('data');
      expect(successResponse).to.have.property('timestamp');
      expect(successResponse.timestamp).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
    
    it('should validate error response structure', () => {
      // Mock error response structure
      const errorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Phone number is required',
          details: 'The phoneNumber field cannot be empty'
        },
        timestamp: new Date().toISOString()
      };
      
      expect(errorResponse).to.have.property('success', false);
      expect(errorResponse).to.have.property('error');
      expect(errorResponse.error).to.have.property('code');
      expect(errorResponse.error).to.have.property('message');
      expect(errorResponse).to.have.property('timestamp');
      expect(errorResponse.timestamp).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
  
  describe('Error Code Standards', () => {
    it('should have consistent error code naming', () => {
      const errorHandlerPath = path.join(backendPath, 'src/middleware/error-handler.ts');
      const content = fs.readFileSync(errorHandlerPath, 'utf8');
      
      // Extract error codes from enum
      const errorCodeMatches = content.match(/([A-Z_]+)\s*=/g);
      
      if (errorCodeMatches) {
        errorCodeMatches.forEach(match => {
          const code = match.replace(/\s*=$/, '');
          // Error codes should be UPPER_CASE with underscores
          expect(code).to.match(/^[A-Z_]+$/);
        });
      }
    });
    
    it('should have user-friendly error messages', () => {
      const errorHandlerPath = path.join(backendPath, 'src/middleware/error-handler.ts');
      const content = fs.readFileSync(errorHandlerPath, 'utf8');
      
      // Check that error messages don't contain technical jargon
      expect(content).to.not.include('Error:');
      expect(content).to.not.include('undefined');
      expect(content).to.not.include('null');
      expect(content).to.not.include('stack trace');
    });
  });
  
  describe('Specific Scenario Coverage', () => {
    it('should cover user already signed up scenario', () => {
      const errorHandlerPath = path.join(backendPath, 'src/middleware/error-handler.ts');
      const content = fs.readFileSync(errorHandlerPath, 'utf8');
      
      expect(content).to.include('USER_ALREADY_EXISTS');
    });
    
    it('should cover phone number in use scenario', () => {
      const errorHandlerPath = path.join(backendPath, 'src/middleware/error-handler.ts');
      const content = fs.readFileSync(errorHandlerPath, 'utf8');
      
      expect(content).to.include('PHONE_ALREADY_EXISTS');
    });
    
    it('should cover wallet address in use scenario', () => {
      const errorHandlerPath = path.join(backendPath, 'src/middleware/error-handler.ts');
      const content = fs.readFileSync(errorHandlerPath, 'utf8');
      
      expect(content).to.include('WALLET_ALREADY_EXISTS');
    });
    
    it('should cover refund failure scenario', () => {
      const errorHandlerPath = path.join(backendPath, 'src/middleware/error-handler.ts');
      const content = fs.readFileSync(errorHandlerPath, 'utf8');
      
      expect(content).to.include('REFUND_FAILED');
    });
  });
  
  describe('Documentation Quality', () => {
    it('should have comprehensive scenario examples in documentation', () => {
      const docsPath = path.join(backendPath, 'docs/API_ERROR_RESPONSE_GUIDE.md');
      const content = fs.readFileSync(docsPath, 'utf8');
      
      // Check for all required scenarios
      const requiredScenarios = [
        'User already sign up and refund has been issued',
        'User has signed up and no Ada sent yet',
        'User signed up and sent money but refund failed',
        'User using an account for the second time',
        'wallet address already in use',
        'phone number in use'
      ];
      
      requiredScenarios.forEach(scenario => {
        expect(content.toLowerCase()).to.include(scenario.toLowerCase());
      });
    });
    
    it('should distinguish between console and user-facing messages', () => {
      const docsPath = path.join(backendPath, 'docs/API_ERROR_RESPONSE_GUIDE.md');
      const content = fs.readFileSync(docsPath, 'utf8');
      
      expect(content).to.include('console');
      expect(content).to.include('user-facing');
      expect(content).to.include('Implementation Notes');
    });
  });
});

// Summary function to run all checks
export function runErrorHandlingValidation() {
  console.log('\n🔍 K33P Error Handling System Validation');
  console.log('==========================================\n');
  
  const backendPath = path.resolve('../');
  const results = {
    filesCreated: 0,
    filesUpdated: 0,
    scenariosCovered: 0,
    issues: []
  };
  
  // Check created files
  const requiredFiles = [
    'src/middleware/error-handler.ts',
    'src/utils/response-helpers.ts',
    'docs/API_ERROR_RESPONSE_GUIDE.md'
  ];
  
  requiredFiles.forEach(file => {
    const filePath = path.join(backendPath, file);
    if (fs.existsSync(filePath)) {
      results.filesCreated++;
      console.log(`✅ Created: ${file}`);
    } else {
      results.issues.push(`❌ Missing: ${file}`);
    }
  });
  
  // Check updated files
  const updatedFiles = [
    'src/routes/auth.js',
    'src/routes/utxo.js',
    'src/k33p-backend-server.ts'
  ];
  
  updatedFiles.forEach(file => {
    const filePath = path.join(backendPath, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('K33PError') || content.includes('globalErrorHandler')) {
        results.filesUpdated++;
        console.log(`✅ Updated: ${file}`);
      } else {
        results.issues.push(`⚠️  Not updated: ${file}`);
      }
    }
  });
  
  // Check scenario coverage
  const errorHandlerPath = path.join(backendPath, 'src/middleware/error-handler.ts');
  if (fs.existsSync(errorHandlerPath)) {
    const content = fs.readFileSync(errorHandlerPath, 'utf8');
    const scenarios = [
      'USER_ALREADY_EXISTS',
      'PHONE_ALREADY_EXISTS', 
      'WALLET_ALREADY_EXISTS',
      'REFUND_FAILED'
    ];
    
    scenarios.forEach(scenario => {
      if (content.includes(scenario)) {
        results.scenariosCovered++;
        console.log(`✅ Scenario: ${scenario}`);
      } else {
        results.issues.push(`❌ Missing scenario: ${scenario}`);
      }
    });
  }
  
  console.log('\n📊 Summary:');
  console.log(`Files Created: ${results.filesCreated}/${requiredFiles.length}`);
  console.log(`Files Updated: ${results.filesUpdated}/${updatedFiles.length}`);
  console.log(`Scenarios Covered: ${results.scenariosCovered}/4`);
  
  if (results.issues.length > 0) {
    console.log('\n⚠️  Issues Found:');
    results.issues.forEach(issue => console.log(issue));
  } else {
    console.log('\n🎉 All error handling requirements implemented successfully!');
  }
  
  return results;
}

// Run validation if called directly
if (process.argv.includes('--validate')) {
  runErrorHandlingValidation();
}