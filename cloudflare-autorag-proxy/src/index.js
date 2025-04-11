/**
 * AutoRAG Proxy Worker with KV Cache Support
 * Acts as a middleman between Netlify and Cloudflare AutoRAG API
 * Also provides persistent caching capabilities
 */

export default {
  async fetch(request, env, ctx) {
    // CORS headers for all responses
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    };
    
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Extract the URL path to determine the action
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CACHE OPERATIONS
    if (path.startsWith('/cache/')) {
      // Only allow POST for cache operations
      if (request.method !== "POST") {
        return new Response("Method not allowed for cache operations", { 
          status: 405,
          headers: corsHeaders
        });
      }
      
      // Parse request body
      let cacheRequest;
      try {
        cacheRequest = await request.json();
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: "Invalid JSON body for cache operation" 
        }), { 
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      
      // GET operation - retrieve cached data
      if (path === '/cache/get') {
        const { key } = cacheRequest;
        
        if (!key) {
          return new Response(JSON.stringify({ 
            error: "Missing required parameter: key" 
          }), { 
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }
        
        try {
          // Retrieve from KV store
          const cachedValue = await env.AUTORAG_CACHE.get(key);
          
          return new Response(JSON.stringify({
            success: true,
            value: cachedValue
          }), {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: "Failed to retrieve from cache",
            message: error.message
          }), {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }
      }
      
      // SET operation - store data in cache
      if (path === '/cache/set') {
        const { key, value, ttl } = cacheRequest;
        
        if (!key || value === undefined) {
          return new Response(JSON.stringify({ 
            error: "Missing required parameters: key and value" 
          }), { 
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }
        
        try {
          // Store in KV with optional TTL
          const options = ttl ? { expirationTtl: ttl } : {};
          await env.AUTORAG_CACHE.put(key, JSON.stringify(value), options);
          
          return new Response(JSON.stringify({
            success: true
          }), {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: "Failed to store in cache",
            message: error.message
          }), {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }
      }
    }

    // DEFAULT: AUTORAG API PROXY
    // Only allow POST for AutoRAG requests
    if (request.method !== "POST") {
      return new Response("Method not allowed", { 
        status: 405,
        headers: corsHeaders
      });
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({
        error: "Invalid JSON body"
      }), { 
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    // Validate required fields
    if (!requestBody.query) {
      return new Response(JSON.stringify({
        error: "Missing required field: query"
      }), { 
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    // Extract query and conversation history
    const { query, conversation_history, system_prompt } = requestBody;

    // Build AutoRAG API URL
    const autoragUrl = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/autorag/rags/${env.CLOUDFLARE_AUTORAG_NAME}/ai-search`;

    // Prepare the request to Cloudflare AutoRAG
    const autoragRequest = {
      query: query,
      model: '@cf/meta/llama-3.1-8b-instruct-fast',
      rewrite_query: true,
      max_num_results: 5,
      ranking_options: {
        score_threshold: 0.6
      },
      stream: false,
      conversation_history: conversation_history || [],
      system_prompt: system_prompt || "You are a helpful customer support agent for Checkbox."
    };

    try {
      // Make the request to the AutoRAG API
      const response = await fetch(autoragUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(autoragRequest)
      });

      // If the request failed, throw an error
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`AutoRAG API error: ${response.status} - ${error}`);
      }

      // Parse the response
      const data = await response.json();

      // Format the response for the client
      const clientResponse = {
        status: "success",
        response: data.result.response,
        timestamp: new Date().toISOString(),
        inquiryId: Math.random().toString(36).substring(2, 12),
        sources: data.result.data.map(doc => ({
          filename: doc.filename,
          score: doc.score,
          content: doc.content
        })) || []
      };

      return new Response(JSON.stringify(clientResponse), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    } catch (error) {
      console.error("Error connecting to AutoRAG API:", error);
      
      return new Response(JSON.stringify({
        status: "error",
        error: "Failed to connect to AutoRAG API",
        message: error.message
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
  }
};
