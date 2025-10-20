import https from 'https';

const options = {
  hostname: 'cardano-preprod.blockfrost.io',
  port: 443,
  path: '/api/v0/health',
  method: 'GET',
  headers: {
    'project_id': 'preprodZIx5fPLLilrrK99ISQoodwXkn5NAmzVR'
  },
  timeout: 10000
};

console.log('Testing Blockfrost connection...');

const req = https.request(options, (res) => {
  console.log('✅ Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Response:', data));
});

req.on('error', (error) => {
  console.log('❌ Error:', error.message);
});

req.on('timeout', () => {
  console.log('❌ Request timed out');
  req.destroy();
});

req.end();
