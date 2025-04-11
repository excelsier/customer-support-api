# Customer Support API with Cloudflare AutoRAG Integration

A Node.js-based customer support API that leverages Cloudflare's AutoRAG service to provide intelligent, context-aware responses to customer inquiries.

## Features

- **Cloudflare AutoRAG Integration**: Connect to Cloudflare's AutoRAG service for AI-powered responses
- **Conversation History**: Track conversation context for more relevant answers
- **In-Memory Caching**: Optimize performance in serverless environments
- **Cloudflare Worker Proxy**: Solve cross-origin and authentication challenges
- **Robust Error Handling**: Fallback responses when services are unavailable

## Architecture

This solution uses a three-tier architecture:
1. **Frontend**: Simple HTML/JS client interface
2. **Serverless API**: Node.js Express app deployed as Netlify function
3. **Cloudflare Worker**: Proxy service that connects securely to AutoRAG

## Deployment

The system is deployed at:
- **API Endpoint**: https://customer-support-api.windsurf.build/api/customer-support
- **Status Endpoint**: https://customer-support-api.windsurf.build/api/status

## Environment Variables

The following environment variables should be configured:
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
- `CLOUDFLARE_AUTORAG_NAME`: Name of your AutoRAG instance
- `CLOUDFLARE_API_TOKEN`: API token with access to AutoRAG

## Local Development

```bash
# Install dependencies
npm install

# Run locally
npm start
```

## Testing

```bash
# Test the AutoRAG connection
node verify-autorag.js

# Run a simple query test
node simple-test.js
```

## License

MIT
