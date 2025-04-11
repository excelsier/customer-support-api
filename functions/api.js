const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Create API app
const app = express();
app.use(bodyParser.json());

// Simple in-memory cache for serverless environment
class InMemoryCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxCacheSize || 1000;
    this.ttl = options.ttl || 24 * 60 * 60 * 1000; // 24 hours by default
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry if at capacity
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
    return value;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  getStats() {
    let valid = 0;
    const now = Date.now();
    
    this.cache.forEach(entry => {
      if (now - entry.timestamp <= this.ttl) {
        valid++;
      }
    });
    
    return {
      total: this.cache.size,
      valid
    };
  }
}

// Use in-memory cache for serverless environment
const cache = new InMemoryCache({
  maxCacheSize: process.env.MAX_CACHE_SIZE || 1000,
  ttl: process.env.CACHE_TTL || 24 * 60 * 60 * 1000
});

console.log('Using in-memory cache for serverless environment');

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
    
    // Connect via Cloudflare Worker proxy instead of directly to AutoRAG
    // URL of the deployed Cloudflare Worker
    const workerUrl = "https://autorag-proxy.excelsier.workers.dev";
    
    let response;
    try {
      console.log('Connecting to AutoRAG through Cloudflare Worker proxy...');
      console.log(`Worker URL: ${workerUrl}`);
      
      const cfResponse = await axios.post(workerUrl, {
        query: message,
        conversation_history: conversationHistory,
        system_prompt: "You are a helpful customer support agent for Checkbox."
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Use the response from the Cloudflare Worker
      response = {
        status: "success",
        response: cfResponse.data.response,
        timestamp: new Date().toISOString(),
        inquiryId: Math.random().toString(36).substring(2, 12),
        sources: cfResponse.data.sources || []
      };
        
        console.log('Successfully received response from Cloudflare AutoRAG');
      } catch (cloudflareError) {
        console.error('Error connecting to Cloudflare:', cloudflareError.message);
        // Fall back to mock response if Cloudflare call fails
        response = {
          status: "success",
          response: `I couldn't connect to our knowledge base at the moment. Please try again later or contact our technical support team if the issue persists.\n\nYour query was: "${message}"`,
          timestamp: new Date().toISOString(),
          inquiryId: Math.random().toString(36).substring(2, 12),
          sources: []
        };
      }
      
      // Record the conversation
      customer.messages.push(
        { role: 'user', content: message },
        { role: 'assistant', content: response.response }
      );
      saveCustomerProfile(customerEmail, customerName, []);
      
      // Store in cache
      cache.set(cacheKey, response);
      
      res.json(response);
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
