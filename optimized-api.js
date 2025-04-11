/**
 * Optimized API Server for Customer Support
 * Integrates with Node-RED and adds performance optimizations
 */

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Import optimization modules
const OptimizationManager = require('./optimization-manager');

// Create API server
const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

// Root route to provide basic information
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Customer Support API</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #2c3e50; }
        .card { background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        pre { background: #f1f1f1; padding: 15px; border-radius: 4px; overflow-x: auto; }
        a { color: #3498db; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .endpoint { margin-bottom: 15px; }
        .method { display: inline-block; padding: 3px 6px; border-radius: 4px; font-size: 14px; font-weight: bold; margin-right: 10px; }
        .post { background: #4CAF50; color: white; }
        .get { background: #2196F3; color: white; }
      </style>
    </head>
    <body>
      <h1>Customer Support API</h1>
      <p>Welcome to the optimized Customer Support API powered by Cloudflare AutoRAG.</p>
      
      <div class="card">
        <h2>Available Endpoints</h2>
        
        <div class="endpoint">
          <span class="method post">POST</span>
          <strong>/api/customer-support</strong>
          <p>Send customer support queries and get AI-powered responses with context awareness.</p>
          <pre>{
  "message": "Your question here",
  "email": "customer@example.com",
  "name": "Customer Name"
}</pre>
        </div>
        
        <div class="endpoint">
          <span class="method get">GET</span>
          <strong>/api/status</strong>
          <p>Check the system status and performance metrics.</p>
        </div>
        
        <div class="endpoint">
          <span class="method get">GET</span>
          <strong>/admin</strong>
          <p>Access the performance monitoring dashboard.</p>
        </div>
      </div>
      
      <div class="card">
        <h2>Quick Links</h2>
        <p><a href="/admin">Performance Dashboard</a></p>
        <p><a href="/api/status">System Status</a></p>
      </div>
      
      <div class="card">
        <h2>Example Usage</h2>
        <pre>fetch('http://localhost:3001/api/customer-support', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "How do I create a new ticket in Checkbox?",
    email: "customer@example.com",
    name: "Customer Name"
  })
})</pre>
      </div>
    </body>
    </html>
  `);
});

// Create optimization manager
const optimizationManager = new OptimizationManager({
  serverUrl: 'http://localhost:1883',
  apiEndpoint: '/customer-support',
  preWarmEnabled: true,
  debugMode: true,
  cacheDir: path.join(__dirname, 'cache'),
  maxCacheSize: 2000,
  cacheTtl: 24 * 60 * 60 * 1000, // 24 hours
  cleanInterval: 60 * 60 * 1000 // 1 hour
});

// Start pre-warming right away
optimizationManager.preWarmCache();

// Main API endpoint - optimized version
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
    
    // Process request through optimization manager
    const response = await optimizationManager.processRequest({
      message,
      email: email || 'anonymous@user.com',
      name: name || 'Anonymous User'
    });
    
    res.json(response);
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
    stats: optimizationManager.getStats()
  });
});

// Admin dashboard (simple HTML)
app.get('/admin', (req, res) => {
  const dashboardHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Customer Support - Performance Dashboard</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }
    .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    h1, h2, h3 { margin-top: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
    th { background-color: #f2f2f2; }
    .stat-row { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; }
    .stat-card { flex: 1; min-width: 200px; background: #f9f9f9; border-radius: 8px; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .stat-value { font-size: 24px; font-weight: bold; margin: 10px 0; }
    .stat-label { font-size: 14px; color: #666; }
    .success { color: #28a745; }
    .warning { color: #ffc107; }
    .error { color: #dc3545; }
    button { background: #4CAF50; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; font-size: 14px; }
    button:hover { background: #388E3C; }
    .refresh-btn { background: #2196F3; margin-right: 10px; }
    .refresh-btn:hover { background: #0b7dda; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Customer Support Performance Dashboard</h1>
    <p>Monitor system performance and optimize response times</p>
    <button id="refreshBtn" class="refresh-btn">Refresh Data</button>
    <button id="preWarmBtn">Pre-warm Cache</button>
  </div>
  
  <div class="stat-row" id="summaryStats">
    <!-- Summary stats will be inserted here -->
  </div>
  
  <div class="card">
    <h2>Request Queue</h2>
    <div id="queueStats">Loading...</div>
  </div>
  
  <div class="card">
    <h2>Cache Performance</h2>
    <div id="cacheStats">Loading...</div>
  </div>
  
  <div class="card">
    <h2>Common Queries</h2>
    <div id="commonQueries">Loading...</div>
  </div>
  
  <script>
    // Load dashboard data
    async function loadDashboard() {
      try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        // Update summary stats
        const summaryHTML = \`
          <div class="stat-card">
            <div class="stat-label">Total Requests</div>
            <div class="stat-value">\${data.stats.requestProcessing.totalRequests}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Cache Hit Rate</div>
            <div class="stat-value \${data.stats.requestProcessing.hitRate > 70 ? 'success' : 'warning'}">\${data.stats.requestProcessing.hitRate.toFixed(1)}%</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Active Requests</div>
            <div class="stat-value">\${data.stats.queue.activeRequests}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Queue Length</div>
            <div class="stat-value \${data.stats.queue.queueLength > 10 ? 'error' : 'success'}">\${data.stats.queue.queueLength}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Cache Size</div>
            <div class="stat-value">\${data.stats.cache.valid} / \${data.stats.cache.total}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Last Update</div>
            <div class="stat-value" style="font-size: 16px">\${new Date().toLocaleTimeString()}</div>
          </div>
        \`;
        document.getElementById('summaryStats').innerHTML = summaryHTML;
        
        // Update queue stats
        document.getElementById('queueStats').innerHTML = \`
          <table>
            <tr>
              <th>Metric</th>
              <th>Value</th>
            </tr>
            <tr>
              <td>Queue Length</td>
              <td>\${data.stats.queue.queueLength}</td>
            </tr>
            <tr>
              <td>Active Requests</td>
              <td>\${data.stats.queue.activeRequests}</td>
            </tr>
            <tr>
              <td>Total Managed Requests</td>
              <td>\${data.stats.queue.totalRequests}</td>
            </tr>
          </table>
        \`;
        
        // Update cache stats
        document.getElementById('cacheStats').innerHTML = \`
          <table>
            <tr>
              <th>Metric</th>
              <th>Value</th>
            </tr>
            <tr>
              <td>Total Cache Entries</td>
              <td>\${data.stats.cache.total}</td>
            </tr>
            <tr>
              <td>Valid Entries</td>
              <td>\${data.stats.cache.valid}</td>
            </tr>
            <tr>
              <td>Expired Entries</td>
              <td>\${data.stats.cache.expired}</td>
            </tr>
            <tr>
              <td>Cache Hits</td>
              <td>\${data.stats.requestProcessing.cacheHits}</td>
            </tr>
            <tr>
              <td>Cache Misses</td>
              <td>\${data.stats.requestProcessing.cacheMisses}</td>
            </tr>
            <tr>
              <td>Hit Rate</td>
              <td>\${data.stats.requestProcessing.hitRate.toFixed(1)}%</td>
            </tr>
            <tr>
              <td>Last Cleanup</td>
              <td>\${new Date(data.stats.cache.lastCleanup).toLocaleString()}</td>
            </tr>
          </table>
        \`;
        
        // Load common queries
        loadCommonQueries();
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      }
    }
    
    // Load common queries from file
    async function loadCommonQueries() {
      try {
        const response = await fetch('/common-queries.json');
        const queries = await response.json();
        
        if (queries && queries.length > 0) {
          let html = '<table><tr><th>#</th><th>Query</th></tr>';
          
          queries.forEach((query, index) => {
            html += \`
              <tr>
                <td>\${index + 1}</td>
                <td>\${query}</td>
              </tr>
            \`;
          });
          
          html += '</table>';
          document.getElementById('commonQueries').innerHTML = html;
        } else {
          document.getElementById('commonQueries').innerHTML = '<p>No common queries recorded yet.</p>';
        }
      } catch (error) {
        document.getElementById('commonQueries').innerHTML = '<p>Error loading common queries.</p>';
      }
    }
    
    // Pre-warm cache
    async function preWarmCache() {
      try {
        document.getElementById('preWarmBtn').disabled = true;
        document.getElementById('preWarmBtn').textContent = 'Pre-warming...';
        
        const response = await fetch('/api/pre-warm', { method: 'POST' });
        const result = await response.json();
        
        alert(\`Cache pre-warming completed. Warmed \${result.warmed} queries.\`);
      } catch (error) {
        console.error('Error pre-warming cache:', error);
        alert('Error pre-warming cache. Check console for details.');
      } finally {
        document.getElementById('preWarmBtn').disabled = false;
        document.getElementById('preWarmBtn').textContent = 'Pre-warm Cache';
        loadDashboard();
      }
    }
    
    // Event listeners
    document.getElementById('refreshBtn').addEventListener('click', loadDashboard);
    document.getElementById('preWarmBtn').addEventListener('click', preWarmCache);
    
    // Load dashboard on page load
    loadDashboard();
    
    // Refresh every 10 seconds
    setInterval(loadDashboard, 10000);
  </script>
</body>
</html>
  `;
  
  res.send(dashboardHtml);
});

// Serve common-queries.json
app.get('/common-queries.json', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'common-queries.json');
    
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      res.send(content);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Error reading common queries file:', error);
    res.status(500).json({ error: 'Failed to read common queries' });
  }
});

// Endpoint to manually trigger pre-warming
app.post('/api/pre-warm', async (req, res) => {
  try {
    const warmed = await optimizationManager.preWarmCache();
    res.json({ success: true, warmed });
  } catch (error) {
    console.error('Error pre-warming cache:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Optimized API server running on port ${PORT}`);
  console.log(`Performance dashboard available at http://localhost:${PORT}/admin`);
});
