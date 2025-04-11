// Simple test for the customer support agent
const http = require('http');

// Configuration
const options = {
  hostname: '127.0.0.1',
  port: 1880,
  path: '/customer-support',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

// Ukrainian query
const ukrainianQuery = 'Як налаштувати мій обліковий запис?';
const postData = JSON.stringify({ message: ukrainianQuery });

console.log(`Sending Ukrainian query: "${ukrainianQuery}"`);
console.log(`To: http://${options.hostname}:${options.port}${options.path}`);

// Send request
const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('\nResponse:');
      console.log(JSON.stringify(response, null, 2));
    } catch (e) {
      console.log('\nRaw response:');
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

// Send the request
req.write(postData);
req.end();
