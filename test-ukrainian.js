// Test Ukrainian language queries with Cloudflare AutoRAG
const https = require('https');

// AutoRAG configuration from flows.json
const config = {
  account_id: 'ced558f4eac9172b07993051961ac91e',
  autorag_name: 'sweet-glitter-e320',
  api_token: 'd8WD_2cCQ3KjQQ5xvUFp3PUWqWdx_wNg5skySkfx'
};

// Ukrainian test queries
const ukrainianQueries = [
  'Як налаштувати мій обліковий запис?',
  'Яка різниця між R2 та Workers KV?',
  'Що таке AutoRAG і як його використовувати?'
];

// Function to send a query to AutoRAG
function testQuery(queryText) {
  return new Promise((resolve, reject) => {
    console.log(`\n----- Testing Ukrainian query: "${queryText}" -----\n`);
    
    const testQuery = {
      query: queryText,
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
    
    console.log(`Sending to: https://${options.hostname}${options.path}`);
    
    // Make the request
    const req = https.request(options, (res) => {
      console.log(`Status Code: ${res.statusCode}`);
      
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const responseData = JSON.parse(data);
          
          // Format and display the response
          if (responseData.success === true) {
            console.log('✅ Query successful!');
            console.log('\nResponse:');
            console.log(responseData.result.response);
            
            // Show sources if any
            if (responseData.result.data && responseData.result.data.length > 0) {
              console.log('\nSources:');
              responseData.result.data.forEach((doc, i) => {
                console.log(`${i+1}. ${doc.filename} (score: ${doc.score.toFixed(2)})`);
              });
            } else {
              console.log('\nNo documents matched this query.');
            }
          } else {
            console.log('❌ Query failed:');
            console.log(JSON.stringify(responseData, null, 2));
          }
          
          resolve(responseData);
        } catch (error) {
          console.log('Could not parse response as JSON:');
          console.log(data);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Connection error:', error.message);
      reject(error);
    });
    
    // Write the request data
    req.write(JSON.stringify(testQuery));
    req.end();
    
    console.log('Request sent, waiting for response...');
  });
}

// Run tests sequentially
async function runTests() {
  console.log('Starting Ukrainian language query tests with Cloudflare AutoRAG...\n');
  
  for (const query of ukrainianQueries) {
    try {
      await testQuery(query);
      // Add a separator between tests
      console.log('\n' + '='.repeat(70) + '\n');
      
      // Wait a bit between queries to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.error('Error during test:', error);
    }
  }
  
  console.log('All tests completed!');
}

// Start testing
runTests();
