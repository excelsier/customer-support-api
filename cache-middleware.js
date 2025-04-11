/**
 * Simple caching middleware for Node-RED
 * To use: install as a node dependency in Node-RED
 */
module.exports = function(RED) {
    function CacheNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Cache config
        const cacheName = config.cacheName || 'default_cache';
        const ttlSeconds = parseInt(config.ttlSeconds) || 3600; // 1 hour default
        
        // Initialize cache if needed
        if (!node.context().global.get(cacheName)) {
            node.context().global.set(cacheName, {});
        }
        
        // Get cache object
        const getCache = () => node.context().global.get(cacheName) || {};
        
        // Save cache object
        const saveCache = (cache) => {
            node.context().global.set(cacheName, cache);
        };
        
        // Cleanup expired entries
        const cleanupCache = () => {
            const cache = getCache();
            const now = Date.now();
            const ttlMs = ttlSeconds * 1000;
            
            Object.keys(cache).forEach(key => {
                if (now - cache[key].timestamp > ttlMs) {
                    delete cache[key];
                }
            });
            
            saveCache(cache);
            return cache;
        };
        
        node.on('input', function(msg) {
            const cache = cleanupCache();
            
            // Extract key - handle various message formats
            let cacheKey;
            if (typeof msg.payload === 'object' && msg.payload.message) {
                cacheKey = msg.payload.message;
            } else if (typeof msg.payload === 'string') {
                cacheKey = msg.payload;
            } else {
                cacheKey = JSON.stringify(msg.payload);
            }
            
            // Check for cache hit
            if (cache[cacheKey]) {
                msg.payload = cache[cacheKey].value;
                msg.cached = true;
                node.status({ fill: "green", shape: "dot", text: "Cache hit" });
                node.send([null, msg]); // Send to second output (cache hit)
                return;
            }
            
            // Handle cache miss
            msg._cacheKey = cacheKey; // Store key for later use
            node.status({ fill: "yellow", shape: "ring", text: "Cache miss" });
            node.send([msg, null]); // Send to first output (cache miss)
        });
        
        // Listen for messages to the second input (for storing responses)
        node.on('input', function(msg, send, done) {
            if (msg.cacheStore && msg._cacheKey) {
                const cache = getCache();
                cache[msg._cacheKey] = {
                    value: msg.payload,
                    timestamp: Date.now()
                };
                saveCache(cache);
                node.status({ fill: "blue", shape: "dot", text: "Cached response" });
            }
            done();
        }, 1); // Second input
    }
    
    RED.nodes.registerType("cache", CacheNode);
};
