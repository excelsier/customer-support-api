// Test a single knowledge base query with Cloudflare AutoRAG
const https = require('https');

// AutoRAG configuration
const config = {
  account_id: 'ced558f4eac9172b07993051961ac91e',
  autorag_name: 'sweet-glitter-e320',
  api_token: 'd8WD_2cCQ3KjQQ5xvUFp3PUWqWdx_wNg5skySkfx'
};

// Single query known to be in the knowledge base
const query = 'Яка структура запитів та відповідей в API Checkbox?';

console.log(`Testing query: "${query}"`);

const requestData = {
  query: query,
  model: '@cf/meta/llama-3.1-8b-instruct-fast',
  rewrite_query: true,
  max_num_results: 5,
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

console.log('Sending request to AutoRAG...');

// Make the request
const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
    process.stdout.write('.');  // Show progress
  });
  
  res.on('end', () => {
    console.log('\nResponse received!');
    
    try {
      const responseData = JSON.parse(data);
      
      if (responseData.success === true) {
        console.log('\n=== RESPONSE TEXT ===');
        console.log(responseData.result.response);
        
        // Check for sources
        if (responseData.result.data && responseData.result.data.length > 0) {
          console.log('\n=== SOURCES ===');
          responseData.result.data.forEach((doc, i) => {
            console.log(`${i+1}. ${doc.filename} (score: ${doc.score.toFixed(2)})`);
          });
          console.log('\nKnowledge base is working! Document sources were found for the query.');
        } else {
          console.log('\nNo document sources found for this query in the knowledge base.');
        }
      } else {
        console.log('\nAPI Error:');
        console.log(JSON.stringify(responseData, null, 2));
      }
    } catch (error) {
      console.log('\nError parsing response:');
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('Connection error:', error.message);
});

// Set a timeout to prevent hanging
req.setTimeout(15000, () => {
  console.log('Request timed out after 15 seconds');
  req.destroy();
});

// Write the request data and end
req.write(JSON.stringify(requestData));
req.end();

console.log('Request sent, waiting for response (timeout: 15s)...');
