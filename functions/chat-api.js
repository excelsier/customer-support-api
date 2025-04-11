const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const axios = require('axios');
const PersistentCache = require('./persistent-cache');
const { detectComplexIssue } = require('./complex-issue-detector');
const NotificationService = require('./notification-service');

// Create a dedicated chat API endpoint
const app = express();
app.use(bodyParser.json());

// Simple in-memory store for customer data
const CUSTOMER_PROFILES = {};

// Use persistent cache
const cache = new PersistentCache({
  maxCacheSize: process.env.MAX_CACHE_SIZE || 1000,
  ttl: process.env.CACHE_TTL || 24 * 60 * 60,  // TTL in seconds for KV
  workerUrl: "https://autorag-proxy.excelsier.workers.dev",
  verbose: true
});

// Initialize notification service
const notificationService = new NotificationService({
  email: {
    enabled: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
    recipientEmail: process.env.SUPPORT_EMAIL || 'support@example.com'
  },
  slack: {
    enabled: process.env.ENABLE_SLACK_NOTIFICATIONS === 'true',
    webhookUrl: process.env.SLACK_WEBHOOK_URL
  },
  logging: {
    enabled: true,
    logLevel: 'info'
  }
});

// Helper function to save a customer profile
function saveCustomerProfile(email, name, messages = []) {
  // Get existing profile or create new one
  const existingProfile = CUSTOMER_PROFILES[email] || { messages: [] };
  
  // Update profile
  CUSTOMER_PROFILES[email] = {
    email,
    name,
    messages: messages.length > 0 ? messages : existingProfile.messages,
    lastUpdated: new Date().toISOString()
  };
  
  // Limit conversation history to prevent memory issues in serverless environment
  if (CUSTOMER_PROFILES[email].messages.length > 20) {
    CUSTOMER_PROFILES[email].messages = CUSTOMER_PROFILES[email].messages.slice(-20);
  }
  
  return CUSTOMER_PROFILES[email];
}

// Helper function to get a customer profile
function getCustomerProfile(email) {
  return CUSTOMER_PROFILES[email];
}

// Dedicated chat endpoint for the chat interface
app.post('/', async (req, res) => {
  try {
    console.log('📥 Received chat request');
    
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
    
    const cacheHit = await cache.has(cacheKey);
    if (cacheHit) {
      console.log(`🎯 Cache hit for message: "${message}"`);
      const cachedResponse = await cache.get(cacheKey);
      return res.json(cachedResponse);
    }
    
    // Prepare conversation history for context
    const conversationHistory = customer.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Connect via Cloudflare Worker proxy
    const workerUrl = "https://autorag-proxy.excelsier.workers.dev";
    
    let response;
    
    try {
      console.log('🔄 Connecting to AutoRAG through Cloudflare Worker proxy...');
      
      // Add retry logic with exponential backoff
      const maxRetries = 3;
      let retryCount = 0;
      let lastError = null;
      
      // Retry request with exponential backoff
      while (retryCount < maxRetries) {
        try {
          if (retryCount > 0) {
            // Calculate backoff delay: 2^retry * 1000ms + random jitter
            const backoffDelay = (Math.pow(2, retryCount) * 1000) + (Math.random() * 1000);
            console.log(`⏱️ Retry attempt ${retryCount}. Waiting ${Math.round(backoffDelay)}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
          }
          
          const cfResponse = await axios.post(workerUrl, {
            query: message,
            conversation_history: conversationHistory,
            system_prompt: "You are a helpful customer support agent for Checkbox."
          }, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          response = {
            status: "success",
            response: cfResponse.data.response,
            timestamp: new Date().toISOString(),
            inquiryId: Math.random().toString(36).substring(2, 12),
            sources: cfResponse.data.sources || []
          };
          
          console.log('✅ Successfully received response from Cloudflare AutoRAG');
          
          // Check if this is a complex issue that needs human attention
          const complexIssueResult = detectComplexIssue(
            cfResponse.data.response,
            cfResponse.data.sources || [],
            { lowConfidenceThreshold: 0.7 }
          );
          
          if (complexIssueResult.isComplex) {
            console.log(`🚨 Complex issue detected: ${complexIssueResult.reasons.join(', ')}`);
            
            // Notify about complex issue
            await notificationService.notifyComplexIssue({
              message: message,
              email: customerEmail,
              response: cfResponse.data.response,
              reasons: complexIssueResult.reasons
            });
          }
          
          break; // Success! Exit the retry loop
        } catch (error) {
          lastError = error;
          retryCount++;
          
          // Detect rate limiting specifically
          const isRateLimitError = 
            error.response?.status === 429 ||
            error.message.includes('rate limit') ||
            error.message.includes('too many requests');
          
          if (isRateLimitError) {
            console.warn('⚠️ Rate limit detected. Will retry with backoff.');
          } else if (retryCount >= maxRetries) {
            // On final retry, rethrow the error
            throw error;
          } else {
            console.warn(`⚠️ Request failed (attempt ${retryCount}/${maxRetries}): ${error.message}`);
          }
        }
      }
      
      if (lastError) {
        // If we exhausted all retries, throw the last error
        throw lastError;
      }
    } catch (cloudflareError) {
      console.error('❌ Error connecting to Cloudflare:', cloudflareError.message);
      
      const isRateLimit = 
        cloudflareError.response?.status === 429 ||
        cloudflareError.message.includes('rate limit') ||
        cloudflareError.message.includes('too many requests');
      
      let errorMessage;
      if (isRateLimit) {
        errorMessage = `I'm currently experiencing high demand and have reached a rate limit. Please try again in a few moments.\n\nYour query was: "${message}"`;
      } else {
        errorMessage = `I couldn't connect to our knowledge base at the moment. Please try again later or contact our technical support team if the issue persists.\n\nYour query was: "${message}"`;
      }
      
      response = {
        status: "error",
        error: isRateLimit ? "rate_limit_exceeded" : "connection_error",
        response: errorMessage,
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
    
    // Store in cache (async operation)
    await cache.set(cacheKey, response);
    
    return res.json(response);
  } catch (error) {
    console.error('❌ Error handling chat request:', error.message);
    return res.status(500).json({
      status: 'error',
      error: 'Failed to process request',
      message: error.message
    });
  }
});

// Simplified health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Create serverless handler
const handler = serverless(app);
module.exports = { handler };
