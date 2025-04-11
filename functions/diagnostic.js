const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');

// Create a simple diagnostic API
const app = express();
app.use(bodyParser.json());

// Root route that returns basic diagnostics
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Diagnostic API is working',
    timestamp: new Date().toISOString(),
    headers: req.headers,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    route: req.route ? JSON.stringify(req.route) : null
  });
});

// Echo endpoint that returns whatever is sent to it
app.post('/echo', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Echo endpoint',
    timestamp: new Date().toISOString(),
    body: req.body,
    headers: req.headers,
    path: req.path,
    originalUrl: req.originalUrl
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Create serverless handler
const handler = serverless(app);
module.exports = { handler };
