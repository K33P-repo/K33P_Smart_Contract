const fetch = require('node-fetch');

async function testBlockfrost() {
  try {
    console.log('Testing Blockfrost with node-fetch...');
    const response = await fetch('https://cardano-preprod.blockfrost.io/api/v0/health', {
      headers: {
        'project_id': 'preprodZIx5fPLLilrrK99ISQoodwXkn5NAmzVR'
      },
      timeout: 10000
    });
    console.log('✅ Success! Status:', response.status);
    const data = await response.json();
    console.log('Data:', data);
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log('Error details:', error);
  }
}

testBlockfrost();
