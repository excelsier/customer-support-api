const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Import our custom modules
const EnhancedCache = require('../enhanced-cache');

// Create API app
const app = express();
app.use(bodyParser.json());

// Create a cache instance
const cache = new EnhancedCache({
  cacheDir: path.join(__dirname, '../cache'),
  maxCacheSize: 1000,
  ttl: 24 * 60 * 60 * 1000 // 24 hours
});

// Customer profiles (for serverless deployment - using a simpler approach)
const CUSTOMER_PROFILES = {};

// Helper function to save a customer profile
function saveCustomerProfile(email, name, messages = []) {
  if (!email) return null;
  
  const customerId = email.toLowerCase();
  
  // Create or update the profile
  CUSTOMER_PROFILES[customerId] = CUSTOMER_PROFILES[customerId] || {
    id: customerId,
    email: email,
    name: name || email.split('@')[0],
    messages: [],
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString()
  };
  
  // Update the profile
  CUSTOMER_PROFILES[customerId].name = name || CUSTOMER_PROFILES[customerId].name;
  CUSTOMER_PROFILES[customerId].lastSeen = new Date().toISOString();
  
  // Add messages if provided
  if (messages && messages.length > 0) {
    CUSTOMER_PROFILES[customerId].messages = 
      [...CUSTOMER_PROFILES[customerId].messages, ...messages]
        .slice(-50); // Keep only last 50 messages
  }
  
  return CUSTOMER_PROFILES[customerId];
}

// Helper function to get a customer profile
function getCustomerProfile(email) {
  if (!email) return null;
  const customerId = email.toLowerCase();
  return CUSTOMER_PROFILES[customerId] || null;
}

// Main API endpoint for customer support queries
app.post('/api/customer-support', async (req, res) => {
  try {
    // Validate request
    const { message, email, name } = req.body;
    
    if (!message) {
      return res.status(400).json({
        status: 'error',
        error: 'Message is required'
      });
    }
    
    // Get customer profile (or create new one)
    const customerEmail = email || 'anonymous@user.com';
    const customerName = name || 'Anonymous User';
    const customer = getCustomerProfile(customerEmail) || 
                     saveCustomerProfile(customerEmail, customerName);
    
    // Check cache first
    const cacheKey = JSON.stringify({
      message,
      email: customerEmail,
      context: customer.messages.length > 0
    });
    
    if (cache.has(cacheKey)) {
      console.log(`Cache hit for message: "${message}"`);
      return res.json(cache.get(cacheKey));
    }
    
    // Prepare conversation history for context
    const conversationHistory = customer.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Construct the API request to CloudFlare AutoRAG
    // Using mock data for deployment - replace with actual CloudFlare credentials in production
    const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'your-account-id';
    const CLOUDFLARE_AUTORAG_NAME = process.env.CLOUDFLARE_AUTORAG_NAME || 'sweet-glitter-e320';
    
    const autoragUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/autorag/rags/${CLOUDFLARE_AUTORAG_NAME}/ai-search`;
    
    try {
      // For deployment demo, we'll use a mock response since we can't access the real API
      // In production, uncomment the axios code and use real credentials
      /*
      const cfResponse = await axios.post(autoragUrl, {
        query: message,
        model: '@cf/meta/llama-3.1-8b-instruct-fast',
        rewrite_query: true,
        max_num_results: 5,
        ranking_options: {
          score_threshold: 0.6
        },
        stream: false,
        conversation_history: conversationHistory,
        system_prompt: "You are a helpful customer support agent for Checkbox."
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      const autoragResponse = cfResponse.data.result;
      */
      
      // Mock response for deployment demo
      const mockResponse = {
        status: "success",
        response: `Thank you for your query about "${message}". This is a deployed version of our customer support system. In production, this would connect to Cloudflare AutoRAG to provide a real answer based on our knowledge base.`,
        timestamp: new Date().toISOString(),
        inquiryId: Math.random().toString(36).substring(2, 12),
        sources: [
          {
            filename: "example-doc.md",
            score: 0.75
          }
        ]
      };
      
      // Record the conversation
      customer.messages.push(
        { role: 'user', content: message },
        { role: 'assistant', content: mockResponse.response }
      );
      saveCustomerProfile(customerEmail, customerName, []);
      
      // Store in cache
      cache.set(cacheKey, mockResponse);
      
      res.json(mockResponse);
    } catch (error) {
      console.error('Error querying AutoRAG:', error.message);
      res.status(500).json({
        status: 'error',
        error: 'Failed to query knowledge base',
        message: error.message
      });
    }
  } catch (error) {
    console.error('Error handling customer support request:', error.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to process request',
      message: error.message
    });
  }
});

// Status/health endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    customerCount: Object.keys(CUSTOMER_PROFILES).length,
    cacheStats: {
      size: cache.getStats().total,
      valid: cache.getStats().valid
    }
  });
});

// Make compatible with serverless
const handler = serverless(app);
module.exports.handler = async (event, context) => {
  // Just in case, make serverless function never time out before 
  // returning a response
  context.callbackWaitsForEmptyEventLoop = false;
  return await handler(event, context);
};
