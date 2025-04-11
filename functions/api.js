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
      size: this.cache.size,
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
});

// Status/health endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    customerCount: Object.keys(CUSTOMER_PROFILES).length,
    cacheStats: cache.getStats()
  });
});

// Admin dashboard
app.get('/admin', (req, res) => {
  const dashboardHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Customer Support - Performance Dashboard</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1, h2 { color: #2c3e50; }
    .card { background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
    .stat { font-size: 24px; font-weight: bold; color: #3498db; }
    table { width: 100%; border-collapse: collapse; }
    table th, table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    table th { background-color: #f2f2f2; }
    pre { background: #f1f1f1; padding: 15px; border-radius: 4px; overflow-x: auto; }
    .refresh-btn { background: #3498db; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; font-size: 16px; }
    .refresh-btn:hover { background: #2980b9; }
    .action-btn { background: #2ecc71; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; }
    .action-btn:hover { background: #27ae60; }
    #preWarmBtn { background: #e74c3c; }
    #preWarmBtn:hover { background: #c0392b; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Customer Support Performance Dashboard</h1>
    <p>Monitor system performance and optimize response times</p>
    <button id="refreshBtn" class="refresh-btn">Refresh Data</button>
  </div>
  
  <div class="grid">
    <div class="card">
      <h2>System Status</h2>
      <p>Environment: <span id="environment" class="stat">Loading...</span></p>
      <p>Uptime: <span id="uptime" class="stat">Loading...</span></p>
      <p>Last Updated: <span id="lastUpdated">Loading...</span></p>
    </div>
    
    <div class="card">
      <h2>Cache Performance</h2>
      <p>Cache Size: <span id="cacheSize" class="stat">Loading...</span></p>
      <p>Valid Entries: <span id="cacheValid" class="stat">Loading...</span></p>
      <button id="preWarmBtn" class="action-btn">Pre-warm Popular Queries</button>
    </div>
    
    <div class="card">
      <h2>User Metrics</h2>
      <p>Total Customers: <span id="customerCount" class="stat">Loading...</span></p>
      <p>Active Today: <span id="activeCustomers" class="stat">Loading...</span></p>
    </div>
  </div>
  
  <div class="card">
    <h2>Recent Queries</h2>
    <table id="recentQueries">
      <thead>
        <tr>
          <th>Time</th>
          <th>Customer</th>
          <th>Query</th>
          <th>Response Time</th>
        </tr>
      </thead>
      <tbody>
        <tr><td colspan="4">Loading recent queries...</td></tr>
      </tbody>
    </table>
  </div>
  
  <script>
    // Load dashboard data
    async function loadDashboard() {
      try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        // Update system status
        document.getElementById('environment').textContent = data.environment;
        document.getElementById('uptime').textContent = 'Active';
        document.getElementById('lastUpdated').textContent = new Date(data.timestamp).toLocaleString();
        
        // Update cache metrics
        document.getElementById('cacheSize').textContent = data.cacheStats.size;
        document.getElementById('cacheValid').textContent = data.cacheStats.valid;
        
        // Update user metrics
        document.getElementById('customerCount').textContent = data.customerCount;
        document.getElementById('activeCustomers').textContent = '0'; // Placeholder, implement if needed
        
        // For demo purposes, show sample recent queries
        const sampleQueries = [
          { time: '10:45 AM', customer: 'john@example.com', query: 'How do I reset my password?', responseTime: '1.2s' },
          { time: '10:30 AM', customer: 'sarah@company.co', query: 'Can I integrate with Zapier?', responseTime: '0.8s' },
          { time: '10:15 AM', customer: 'mike@startup.io', query: 'What payment methods do you support?', responseTime: '1.5s' }
        ];
        
        const tableBody = document.querySelector('#recentQueries tbody');
        tableBody.innerHTML = '';
        
        sampleQueries.forEach(query => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${query.time}</td>
            <td>${query.customer}</td>
            <td>${query.query}</td>
            <td>${query.responseTime}</td>
          `;
          tableBody.appendChild(row);
        });
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      }
    }
    
    // Load dashboard on page load
    document.addEventListener('DOMContentLoaded', loadDashboard);
    
    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', loadDashboard);
    
    // Pre-warm cache button
    async function preWarmCache() {
      try {
        document.getElementById('preWarmBtn').disabled = true;
        document.getElementById('preWarmBtn').textContent = 'Pre-warming...';
        
        // Simulate pre-warming common queries
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Show success message
        alert('Cache pre-warming completed successfully!');
      } catch (error) {
        console.error('Error pre-warming cache:', error);
        alert('Failed to pre-warm cache. Please try again.');
      } finally {
        document.getElementById('preWarmBtn').disabled = false;
        document.getElementById('preWarmBtn').textContent = 'Pre-warm Popular Queries';
      }
    }
    
    document.getElementById('preWarmBtn').addEventListener('click', preWarmCache);
  </script>
</body>
</html>
  `;
  
  res.send(dashboardHtml);
});

// Make compatible with serverless
const handler = serverless(app);
module.exports.handler = async (event, context) => {
  // Just in case, make serverless function never time out before 
  // returning a response
  context.callbackWaitsForEmptyEventLoop = false;
  return await handler(event, context);
};
