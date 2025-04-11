/**
 * AutoRAG Proxy Worker
 * Acts as a middleman between Netlify and Cloudflare AutoRAG API
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        }
      });
    }
    
    // Only allow POST requests
    if (request.method !== "POST") {
      return new Response("Method not allowed", { 
        status: 405,
        headers: {
          "Access-Control-Allow-Origin": "*",
        }
      });
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      return new Response("Invalid JSON body", { 
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        }
      });
    }

    // Validate required fields
    if (!requestBody.query) {
      return new Response("Missing required field: query", { 
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
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
          score: doc.score
        }))
      };

      // Return the response with proper CORS headers
      return new Response(JSON.stringify(clientResponse), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    } catch (error) {
      // Log the error
      console.error('AutoRAG proxy error:', error);

      // Return an error response
      return new Response(JSON.stringify({
        status: "error",
        error: error.message,
        message: `I couldn't connect to our knowledge base at the moment. Please try again later.`,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
  }
};
