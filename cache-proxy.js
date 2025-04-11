// Cache proxy for customer support agent
// This proxy sits in front of the Node-RED endpoint and caches responses for improved performance

const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 3030;

// Middleware
app.use(express.json());

// Simple in-memory cache
const cache = new Map();
const TTL = 60 * 60 * 1000; // 1 hour in milliseconds

// Clear expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > TTL) {
      cache.delete(key);
    }
  }
}, 10 * 60 * 1000); // Clean every 10 minutes

// Proxy endpoint
app.post('/customer-support', async (req, res) => {
  try {
    const query = req.body.message;
    
    // For non-text queries or missing message, bypass cache
    if (!query || typeof query !== 'string') {
      return proxyRequest(req, res);
    }
    
    // Check cache for exact match
    const cacheKey = query.trim().toLowerCase();
    if (cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey);
      console.log(`Cache hit: "${query.substring(0, 30)}${query.length > 30 ? '...' : ''}"`);
      
      // Return cached response with cache indicator
      const response = { ...cachedData.data, fromCache: true };
      return res.json(response);
    }
    
    // Cache miss - proxy to Node-RED
    console.log(`Cache miss: "${query.substring(0, 30)}${query.length > 30 ? '...' : ''}"`);
    return proxyRequest(req, res, cacheKey);
    
  } catch (error) {
    console.error('Error in proxy:', error.message);
    res.status(500).json({ 
      status: 'error', 
      error: 'Cache proxy error', 
      message: error.message 
    });
  }
});

// Function to proxy request to Node-RED
async function proxyRequest(req, res, cacheKey = null) {
  try {
    // Forward request to Node-RED
    const response = await axios.post(
      'http://localhost:1880/customer-support',
      req.body,
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    // Cache successful responses if we have a cache key
    if (cacheKey && response.data && response.data.status === 'success') {
      cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });
    }
    
    // Return the response
    return res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      // Forward the error response from Node-RED
      return res.status(error.response.status).json(error.response.data);
    } else {
      // Handle network errors
      return res.status(502).json({ 
        status: 'error', 
        error: 'Bad Gateway', 
        message: 'Failed to reach Node-RED server' 
      });
    }
  }
}

// Dashboard endpoint for monitoring cache
app.get('/cache-status', (req, res) => {
  const cacheEntries = Array.from(cache.entries()).map(([key, value]) => ({
    query: key,
    cachedAt: new Date(value.timestamp).toISOString(),
    ageMinutes: Math.round((Date.now() - value.timestamp) / 60000)
  }));
  
  res.json({
    cacheSize: cache.size,
    entries: cacheEntries
  });
});

// Clear cache endpoint (admin use)
app.post('/clear-cache', (req, res) => {
  cache.clear();
  res.json({ status: 'success', message: 'Cache cleared' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Cache proxy running on http://localhost:${PORT}`);
  console.log(`Proxying requests to Node-RED at http://localhost:1880/customer-support`);
  console.log(`View cache status at http://localhost:${PORT}/cache-status`);
});
