// Verify Cloudflare AutoRAG connectivity
const https = require('https');

// AutoRAG configuration from flows.json
const config = {
  account_id: 'ced558f4eac9172b07993051961ac91e',
  autorag_name: 'sweet-glitter-e320',
  api_token: 'd8WD_2cCQ3KjQQ5xvUFp3PUWqWdx_wNg5skySkfx'
};

// Simple test query
const testQuery = {
  query: "Test query to check connectivity",
  model: '@cf/meta/llama-3.1-8b-instruct-fast',
  rewrite_query: true,
  max_num_results: 1,
  ranking_options: {
    score_threshold: 0.6
  },
  stream: false
};

// Create options for the HTTPS request
const options = {
  hostname: 'api.cloudflare.com',
  path: `/client/v4/accounts/${config.account_id}/autorag/rags/${config.autorag_name}/ai-search`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.api_token}`
  }
};

console.log('Verifying Cloudflare AutoRAG connectivity...');
console.log(`Instance: ${config.autorag_name}`);
console.log(`Account ID: ${config.account_id}`);
console.log(`API URL: https://${options.hostname}${options.path}`);

// Make the request
const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse:');
    try {
      const responseData = JSON.parse(data);
      
      // Check if the response was successful
      if (responseData.success === true) {
        console.log('✅ Connection successful!');
        console.log('AutoRAG instance is operational.');
      } else {
        console.log('❌ Connection failed with API error:');
      }
      
      // Output the full response in a readable format
      console.log(JSON.stringify(responseData, null, 2));
    } catch (error) {
      console.log('Could not parse response as JSON:');
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Connection error:', error.message);
});

// Write the request data
req.write(JSON.stringify(testQuery));
req.end();

console.log('Request sent, waiting for response...');
