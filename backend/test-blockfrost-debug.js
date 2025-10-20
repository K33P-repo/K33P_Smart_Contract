const https = require('https');

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

const req = https.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Response:', data));
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.on('timeout', () => {
  console.error('Request timed out');
  req.destroy();
});

req.end();
