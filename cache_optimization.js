// Cache optimization for AutoRAG responses
// This module provides a simple caching layer to reduce API calls and improve response times

module.exports = function(RED) {
    "use strict";
    
    function AutoragCache(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Initialize cache in flow context if it doesn't exist
        if (!node.context().flow.get('autorag_cache')) {
            node.context().flow.set('autorag_cache', {});
        }
        
        // Cache settings
        const TTL = 1000 * 60 * 60; // 1 hour cache TTL
        const SIMILARITY_THRESHOLD = 0.9; // Threshold for considering queries similar
        
        // Simple string similarity function (0-1 score)
        function stringSimilarity(s1, s2) {
            s1 = s1.toLowerCase();
            s2 = s2.toLowerCase();
            
            if (s1 === s2) return 1.0;
            
            // Use Levenshtein distance for similarity
            const longer = s1.length > s2.length ? s1 : s2;
            const shorter = s1.length > s2.length ? s2 : s1;
            
            if (longer.length === 0) return 1.0;
            
            // Calculate Levenshtein distance
            const costs = new Array(shorter.length + 1);
            for (let i = 0; i <= shorter.length; i++) {
                costs[i] = i;
            }
            
            for (let i = 1; i <= longer.length; i++) {
                let lastValue = i;
                costs[0] = i;
                
                for (let j = 1; j <= shorter.length; j++) {
                    let newValue;
                    if (longer.charAt(i - 1) === shorter.charAt(j - 1)) {
                        newValue = costs[j - 1];
                    } else {
                        newValue = Math.min(costs[j - 1] + 1, Math.min(costs[j] + 1, lastValue + 1));
                    }
                    
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
                
                costs[shorter.length] = lastValue;
            }
            
            return (longer.length - costs[shorter.length]) / longer.length;
        }
        
        // Clean expired cache entries
        function cleanCache() {
            const cache = node.context().flow.get('autorag_cache');
            const now = Date.now();
            
            Object.keys(cache).forEach(key => {
                if (now - cache[key].timestamp > TTL) {
                    delete cache[key];
                }
            });
            
            node.context().flow.set('autorag_cache', cache);
        }
        
        node.on('input', function(msg) {
            // Clean expired cache entries
            cleanCache();
            
            const query = msg.payload.message;
            const cache = node.context().flow.get('autorag_cache');
            let cacheHit = false;
            
            // Check for exact match first
            if (cache[query]) {
                msg.payload = cache[query].response;
                msg.cacheHit = true;
                node.status({fill:"green", shape:"dot", text:"Cache hit"});
                node.send(msg);
                return;
            }
            
            // Check for similar queries
            for (const cacheKey in cache) {
                const similarity = stringSimilarity(query, cacheKey);
                if (similarity >= SIMILARITY_THRESHOLD) {
                    msg.payload = cache[cacheKey].response;
                    msg.cacheHit = true;
                    node.status({fill:"green", shape:"dot", text:`Similar query match (${Math.round(similarity * 100)}%)`});
                    node.send(msg);
                    return;
                }
            }
            
            // Cache miss - continue with original query
            node.status({fill:"yellow", shape:"ring", text:"Cache miss"});
            
            // Add handler for storing response in cache
            const originalSend = node.send;
            node.send = function(msgs) {
                if (msgs && !Array.isArray(msgs)) msgs = [msgs];
                
                if (msgs && msgs[0] && msgs[0].payload && msgs[0].payload.status === "success") {
                    // Store successful response in cache
                    cache[query] = {
                        response: msgs[0].payload,
                        timestamp: Date.now()
                    };
                    node.context().flow.set('autorag_cache', cache);
                    node.status({fill:"blue", shape:"dot", text:"Cached new response"});
                }
                
                // Restore original send and call it
                node.send = originalSend;
                node.send(msgs);
            };
            
            // Continue processing
            msg.cacheHit = false;
            node.status({});
            node.send(msg);
        });
        
        node.on('close', function() {
            node.status({});
        });
    }
    
    RED.nodes.registerType("autorag-cache", AutoragCache);
};
