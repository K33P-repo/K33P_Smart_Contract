/**
 * Test script for the K33P Backend signup endpoint on Render
 * Tests the deployed backend at https://k33p-backend-0kyx.onrender.com
 */

import fetch from 'node-fetch';

const RENDER_BASE_URL = 'https://k33p-backend-0kyx.onrender.com';

async function testSignupEndpoint() {
    console.log('🚀 Testing K33P Backend Signup Endpoint on Render');
    console.log('URL:', `${RENDER_BASE_URL}/api/auth/signup`);
    console.log('\n' + '='.repeat(50));

    try {
        // Test data using the correct JSON.stringify approach
        const signupData = {
            userAddress: "addr_test1qr8z9x2y3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5r",
            userId: "testuser234",
            phoneNumber: "1234567890",
            senderWalletAddress: "addr_test1qr8z9x2y3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5r",
            pin: "2345",
            biometricData: "test466",
            verificationMethod: "pin",
            biometricType: "fingerprint"
        };

        console.log('📤 Sending signup request with data:');
        console.log(JSON.stringify(signupData, null, 2));
        console.log('\n' + '-'.repeat(30));

        const response = await fetch(`${RENDER_BASE_URL}/api/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(signupData)
        });

        console.log('📥 Response Status:', response.status, response.statusText);
        console.log('📥 Response Headers:');
        for (const [key, value] of response.headers.entries()) {
            console.log(`   ${key}: ${value}`);
        }

        const responseData = await response.json();
        console.log('\n📥 Response Body:');
        console.log(JSON.stringify(responseData, null, 2));

        if (response.ok) {
            console.log('\n✅ Signup request successful!');
        } else {
            console.log('\n❌ Signup request failed!');
        }

    } catch (error) {
        console.error('\n💥 Error testing signup endpoint:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
        }
    }
}

async function testHealthEndpoint() {
    console.log('\n🏥 Testing Health Endpoint');
    console.log('URL:', `${RENDER_BASE_URL}/api/health`);
    console.log('\n' + '='.repeat(50));

    try {
        const response = await fetch(`${RENDER_BASE_URL}/api/health`);
        console.log('📥 Health Status:', response.status, response.statusText);
        
        const healthData = await response.json();
        console.log('📥 Health Response:');
        console.log(JSON.stringify(healthData, null, 2));

        if (response.ok) {
            console.log('\n✅ Backend is healthy!');
        } else {
            console.log('\n❌ Backend health check failed!');
        }

    } catch (error) {
        console.error('\n💥 Error testing health endpoint:', error.message);
    }
}

async function runTests() {
    console.log('🧪 K33P Backend Render Deployment Test Suite');
    console.log('=' .repeat(60));
    
    // Test health endpoint first
    await testHealthEndpoint();
    
    // Wait a moment between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test signup endpoint
    await testSignupEndpoint();
    
    console.log('\n' + '='.repeat(60));
    console.log('🏁 Test suite completed!');
}

// Run the tests
runTests().catch(console.error);