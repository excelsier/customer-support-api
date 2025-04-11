const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const axios = require('axios');

// Create simple Express app
const app = express();
app.use(bodyParser.json());

// Simple diagnostic endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    cloudflareConfig: {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID ? 'Set ✓' : 'Not set ✗',
      autoragName: process.env.CLOUDFLARE_AUTORAG_NAME ? 'Set ✓' : 'Not set ✗',
      apiToken: process.env.CLOUDFLARE_API_TOKEN ? 'Set ✓' : 'Not set ✗ (Masked for security)'
    }
  });
});

// Simplified API endpoint
app.post('/api/query', async (req, res) => {
  try {
    // Get query from request
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({
        status: 'error',
        error: 'Query is required'
      });
    }
    
    // Hardcoded token for direct testing (same as local environment)
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || 'ced558f4eac9172b07993051961ac91e';
    const autoragName = process.env.CLOUDFLARE_AUTORAG_NAME || 'sweet-glitter-e320';
    const apiToken = process.env.CLOUDFLARE_API_TOKEN || 'd8WD_2cCQ3KjQQ5xvUFp3PUWqWdx_wNg5skySkfx';
    
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/autorag/rags/${autoragName}/ai-search`;
    
    console.log('Attempting to connect to Cloudflare AutoRAG...');
    console.log(`URL: ${url}`);
    console.log(`Query: ${query}`);
    
    try {
      const cfResponse = await axios.post(url, {
        query: query,
        model: '@cf/meta/llama-3.1-8b-instruct-fast',
        rewrite_query: true,
        max_num_results: 3,
        ranking_options: {
          score_threshold: 0.6
        },
        stream: false
      }, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Successfully received response from Cloudflare');
      
      res.json({
        status: 'success',
        cloudflareSuccess: true,
        response: cfResponse.data.result.response,
        timestamp: new Date().toISOString(),
        sources: cfResponse.data.result.data.map(doc => ({
          filename: doc.filename,
          score: doc.score
        }))
      });
    } catch (cloudflareError) {
      console.error('Error connecting to Cloudflare:', cloudflareError.message);
      if (cloudflareError.response) {
        console.error('Response status:', cloudflareError.response.status);
        console.error('Response data:', JSON.stringify(cloudflareError.response.data, null, 2));
      }
      
      res.json({
        status: 'success',
        cloudflareSuccess: false,
        error: cloudflareError.message,
        errorDetails: cloudflareError.response ? {
          status: cloudflareError.response.status,
          data: cloudflareError.response.data
        } : null,
        response: `Diagnostic info - Error connecting to Cloudflare: ${cloudflareError.message}`,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('General error:', error.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to process request',
      message: error.message
    });
  }
});

// Make compatible with serverless
const handler = serverless(app);
module.exports.handler = async (event, context) => {
  // Just in case, make serverless function never time out before 
  // returning a response
  context.callbackWaitsForEmptyEventLoop = false;
  return await handler(event, context);
};
