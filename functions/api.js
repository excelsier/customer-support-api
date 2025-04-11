const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const PersistentCache = require('./persistent-cache');
const { detectComplexIssue } = require('./complex-issue-detector');
const NotificationService = require('./notification-service');

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

// Use persistent cache for serverless environment
const cache = new PersistentCache({
  maxCacheSize: process.env.MAX_CACHE_SIZE || 1000,
  ttl: process.env.CACHE_TTL || 24 * 60 * 60,  // TTL in seconds for KV
  workerUrl: "https://autorag-proxy.excelsier.workers.dev",
  verbose: true
});

console.log('Using persistent cache with Cloudflare KV backing');

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
    level: process.env.LOG_LEVEL || 'info'
  }
});

console.log('Notification service initialized');

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
    
    // Note: has() and get() are now async with PersistentCache
    const cacheHit = await cache.has(cacheKey);
    if (cacheHit) {
      console.log(`Cache hit for message: "${message}"`);
      const cachedResponse = await cache.get(cacheKey);
      return res.json(cachedResponse);
    }
    
    // Prepare conversation history for context
    const conversationHistory = customer.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Construct the API request to CloudFlare AutoRAG
    const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'your-account-id';
    const CLOUDFLARE_AUTORAG_NAME = process.env.CLOUDFLARE_AUTORAG_NAME || 'sweet-glitter-e320';
    
    // Connect via Cloudflare Worker proxy
    const workerUrl = "https://autorag-proxy.excelsier.workers.dev";
    
    let response;
    
    try {
      console.log('Connecting to AutoRAG through Cloudflare Worker proxy...');
      console.log(`Worker URL: ${workerUrl}`);
      
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
            console.log(`Retry attempt ${retryCount}. Waiting ${Math.round(backoffDelay)}ms before retry...`);
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
      
      console.log('Successfully received response from Cloudflare AutoRAG');
      
      // Check if this is a complex issue that needs human attention
      const complexIssueResult = detectComplexIssue(
        cfResponse.data.response,
        cfResponse.data.sources || [],
        { lowConfidenceThreshold: 0.7 }
      );
      
      if (complexIssueResult.isComplex) {
        console.log(`Complex issue detected: ${complexIssueResult.reasons.join(', ')}`);
        
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
            console.warn('Rate limit detected. Will retry with backoff.');
          } else if (retryCount >= maxRetries) {
            // On final retry, rethrow the error
            throw error;
          } else {
            console.warn(`Request failed (attempt ${retryCount}/${maxRetries}): ${error.message}`);
          }
        }
      }
      
      if (lastError) {
        // If we exhausted all retries, throw the last error
        throw lastError;
      }
    } catch (cloudflareError) {
      console.error('Error connecting to Cloudflare:', cloudflareError.message);
      
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
    console.error('Error handling customer support request:', error.message);
    return res.status(500).json({
      status: 'error',
      error: 'Failed to process request',
      message: error.message
    });
  }
});

// Status/health endpoint
app.get('/api/status', async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    customerCount: Object.keys(CUSTOMER_PROFILES).length,
    cacheStats: await cache.getStats(),
    notificationCount: notificationService.notificationCount || 0
  });
});

// Admin dashboard for monitoring
app.get('/admin', (req, res) => {
  const dashboardHtml = fs.readFileSync(path.join(__dirname, '../public/admin-dashboard.html'), 'utf8');
  res.send(dashboardHtml);
});

// API endpoint for recent inquiries
app.get('/api/recent-inquiries', (req, res) => {
  // Get most recent inquiries from customer profiles
  const recentInquiries = [];
  
  Object.values(CUSTOMER_PROFILES).forEach(profile => {
    const userMessages = profile.messages.filter(msg => msg.role === 'user');
    const assistantMessages = profile.messages.filter(msg => msg.role === 'assistant');
    
    for (let i = 0; i < userMessages.length; i++) {
      if (recentInquiries.length >= 10) break;
      
      recentInquiries.push({
        timestamp: new Date(profile.lastSeen).toISOString(),
        email: profile.email,
        query: userMessages[i]?.content || '',
        response: assistantMessages[i]?.content || ''
      });
    }
  });
  
  // Sort by timestamp, most recent first
  recentInquiries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  res.json({
    inquiries: recentInquiries.slice(0, 10)
  });
});

// Make compatible with serverless
const handler = serverless(app);
module.exports.handler = async (event, context) => {
  // Make serverless function never time out before returning a response
  context.callbackWaitsForEmptyEventLoop = false;
  return await handler(event, context);
};
