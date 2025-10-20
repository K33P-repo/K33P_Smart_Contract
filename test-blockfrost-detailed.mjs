import { setDefaultResultOrder } from 'dns';
setDefaultResultOrder('ipv4first');

async function testBlockfrost() {
  try {
    console.log('🔍 Testing Blockfrost API connectivity...');
    
    const response = await fetch('https://cardano-preprod.blockfrost.io/api/v0/health', {
      headers: {
        'project_id': 'preprodZIx5fPLLilrrK99ISQoodwXkn5NAmzVR'
      },
      signal: AbortSignal.timeout(15000)
    });
    
    console.log('✅ HTTP Status:', response.status);
    console.log('✅ Headers:', Object.fromEntries(response.headers));
    
    const data = await response.json();
    console.log('✅ Response Data:', data);
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log('❌ Error name:', error.name);
    console.log('❌ Error code:', error.code);
  }
}

testBlockfrost();
