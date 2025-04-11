// Test script to verify customer support agent's ability to answer questions from knowledge base
const https = require('https');

// AutoRAG configuration from flows.json
const config = {
  account_id: 'ced558f4eac9172b07993051961ac91e',
  autorag_name: 'sweet-glitter-e320',
  api_token: 'd8WD_2cCQ3KjQQ5xvUFp3PUWqWdx_wNg5skySkfx'
};

// Known good queries from the knowledge base (based on previous successful tests)
const knowledgeBaseQueries = [
  {
    query: 'Яка структура запитів та відповідей в API Checkbox?',
    expectedSource: true, // We expect documentation sources to be found
    description: 'Query about Checkbox API request/response structure'
  },
  {
    query: 'Розкажи про авторизацію в API Checkbox',
    expectedSource: true,
    description: 'Query about Checkbox API authentication'
  },
  {
    query: 'Як використовувати веб-хуки в Checkbox?',
    expectedSource: true,
    description: 'Query about Checkbox webhooks'
  },
  {
    query: 'Що таке AutoRAG і як він працює з Checkbox?',
    expectedSource: false, // This is a general question, may not have docs
    description: 'General query about AutoRAG and Checkbox integration'
  }
];

// Function to send a query to AutoRAG and analyze the response
function testKnowledgeQuery(queryInfo) {
  return new Promise((resolve, reject) => {
    console.log(`\n----- Testing Knowledge Base Query -----`);
    console.log(`Query: "${queryInfo.query}"`);
    console.log(`Description: ${queryInfo.description}`);
    console.log(`Expected to find sources: ${queryInfo.expectedSource ? 'Yes' : 'Not necessarily'}\n`);
    
    const testQuery = {
      query: queryInfo.query,
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
    
    // Track metrics for the response
    const startTime = Date.now();
    
    // Make the request
    const req = https.request(options, (res) => {
      console.log(`Status Code: ${res.statusCode}`);
      
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        console.log(`Response time: ${responseTime}ms`);
        
        try {
          const responseData = JSON.parse(data);
          
          // Check if the response was successful
          if (responseData.success === true) {
            const foundSources = responseData.result.data && responseData.result.data.length > 0;
            
            // Determine if we have what we expect
            const expectationMet = (queryInfo.expectedSource === foundSources);
            
            // Display overall success based on expectations
            if (expectationMet) {
              console.log('✅ Test PASSED: Results match expectations');
            } else {
              console.log('❌ Test FAILED: Results do not match expectations');
              console.log(`Expected to find sources: ${queryInfo.expectedSource}`);
              console.log(`Actually found sources: ${foundSources}`);
            }
            
            // Show the response
            console.log('\nResponse:');
            console.log(responseData.result.response);
            
            // Show sources if any
            if (foundSources) {
              console.log('\nSources found:');
              responseData.result.data.forEach((doc, i) => {
                console.log(`${i+1}. ${doc.filename} (score: ${doc.score.toFixed(2)})`);
              });
            } else {
              console.log('\nNo sources found in the knowledge base.');
            }
            
            // Analysis of response quality
            const responseLength = responseData.result.response.length;
            console.log(`\nResponse length: ${responseLength} characters`);
            
            // Analyze if the response looks like a proper answer
            const containsKeyPhrases = [
              'не знаю', 'не можу', 'вибачте', 'не маю інформації'
            ].some(phrase => responseData.result.response.toLowerCase().includes(phrase));
            
            if (containsKeyPhrases && queryInfo.expectedSource) {
              console.log('⚠️ Warning: Response contains uncertainty phrases but sources were expected');
            }
            
            resolve({
              success: true,
              expectationMet,
              responseTime,
              hasDocuments: foundSources,
              response: responseData.result.response,
              documents: responseData.result.data || []
            });
          } else {
            console.log('❌ Query failed:');
            console.log(JSON.stringify(responseData, null, 2));
            resolve({
              success: false,
              error: responseData
            });
          }
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
  });
}

// Run all tests sequentially
async function runTests() {
  console.log('Starting knowledge base query tests with Cloudflare AutoRAG...\n');
  console.log('Testing if agent can properly answer questions from knowledge base examples');
  console.log('='.repeat(70) + '\n');
  
  const results = {
    passedTests: 0,
    failedTests: 0,
    withDocuments: 0,
    withoutDocuments: 0,
    averageResponseTime: 0,
    totalResponseTime: 0
  };
  
  for (const queryInfo of knowledgeBaseQueries) {
    try {
      const testResult = await testKnowledgeQuery(queryInfo);
      
      // Update statistics
      if (testResult.success) {
        if (testResult.expectationMet) {
          results.passedTests++;
        } else {
          results.failedTests++;
        }
        
        if (testResult.hasDocuments) {
          results.withDocuments++;
        } else {
          results.withoutDocuments++;
        }
        
        results.totalResponseTime += testResult.responseTime;
      } else {
        results.failedTests++;
      }
      
      // Add a separator between tests
      console.log('\n' + '='.repeat(70) + '\n');
      
      // Wait a bit between queries to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.error('Error during test:', error);
      results.failedTests++;
    }
  }
  
  // Calculate average response time
  results.averageResponseTime = Math.round(results.totalResponseTime / knowledgeBaseQueries.length);
  
  // Display summary
  console.log('====== TEST SUMMARY ======');
  console.log(`Total queries tested: ${knowledgeBaseQueries.length}`);
  console.log(`Tests passed: ${results.passedTests}`);
  console.log(`Tests failed: ${results.failedTests}`);
  console.log(`Queries with document matches: ${results.withDocuments}`);
  console.log(`Queries without document matches: ${results.withoutDocuments}`);
  console.log(`Average response time: ${results.averageResponseTime}ms`);
  console.log('=========================');
  
  if (results.passedTests === knowledgeBaseQueries.length) {
    console.log('✅ ALL TESTS PASSED: The customer support agent is functioning as expected with the knowledge base!');
  } else {
    console.log(`❌ ${results.failedTests} TEST(S) FAILED: The customer support agent needs improvement or knowledge base updates.`);
  }
}

// Start the tests
runTests();
