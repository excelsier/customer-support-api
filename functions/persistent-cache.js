/**
 * Persistent Cache Implementation using Cloudflare KV
 * This cache implementation persists data across serverless function executions
 * by using Cloudflare KV as a backing store.
 */

const axios = require('axios');

class PersistentCache {
  constructor(options = {}) {
    // Local memory cache for faster access to recent items
    this.cache = new Map();
    
    // Configuration
    this.maxSize = options.maxCacheSize || 1000;
    this.ttl = options.ttl || 24 * 60 * 60; // TTL in seconds for Cloudflare KV
    this.workerUrl = options.workerUrl || "https://autorag-proxy.excelsier.workers.dev";
    
    // Logging
    this.verbose = options.verbose || false;
    
    if (this.verbose) {
      console.log(`PersistentCache initialized with TTL: ${this.ttl}s, maxSize: ${this.maxSize}, workerUrl: ${this.workerUrl}`);
    }
  }

  /**
   * Store value in both local memory and Cloudflare KV
   */
  async set(key, value) {
    // Validate input
    if (!key) {
      console.error("Cannot cache with empty key");
      return null;
    }
    
    const stringKey = typeof key === 'string' ? key : JSON.stringify(key);
    
    // Store in local memory
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry if at capacity
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(stringKey, {
      value,
      timestamp: Date.now()
    });
    
    // Also store in Cloudflare KV
    try {
      if (this.verbose) {
        console.log(`Storing in Cloudflare KV: ${stringKey.substring(0, 50)}${stringKey.length > 50 ? '...' : ''}`);
      }
      
      await axios.post(`${this.workerUrl}/cache/set`, {
        key: stringKey,
        value: value,
        ttl: this.ttl
      });
    } catch (error) {
      console.error("Failed to persist cache to Cloudflare KV:", error.message);
    }
    
    return value;
  }

  /**
   * Get value from cache, checking local memory first, then Cloudflare KV
   */
  async get(key) {
    if (!key) return null;
    
    const stringKey = typeof key === 'string' ? key : JSON.stringify(key);
    
    // Check local memory first
    const entry = this.cache.get(stringKey);
    if (entry && Date.now() - entry.timestamp <= this.ttl * 1000) {
      if (this.verbose) {
        console.log(`Cache hit (memory): ${stringKey.substring(0, 50)}${stringKey.length > 50 ? '...' : ''}`);
      }
      return entry.value;
    }
    
    // If not in memory or expired, try Cloudflare KV
    try {
      if (this.verbose) {
        console.log(`Cache miss (memory), checking KV: ${stringKey.substring(0, 50)}${stringKey.length > 50 ? '...' : ''}`);
      }
      
      const response = await axios.post(`${this.workerUrl}/cache/get`, {
        key: stringKey
      });
      
      if (response.data.value) {
        // Put back in memory cache
        const value = JSON.parse(response.data.value);
        
        this.cache.set(stringKey, {
          value,
          timestamp: Date.now()
        });
        
        if (this.verbose) {
          console.log(`Cache hit (KV): ${stringKey.substring(0, 50)}${stringKey.length > 50 ? '...' : ''}`);
        }
        
        return value;
      }
    } catch (error) {
      console.error("Failed to retrieve from Cloudflare KV cache:", error.message);
    }
    
    if (this.verbose) {
      console.log(`Cache miss (both memory and KV): ${stringKey.substring(0, 50)}${stringKey.length > 50 ? '...' : ''}`);
    }
    
    return null;
  }

  /**
   * Check if key exists in either local memory or Cloudflare KV
   */
  async has(key) {
    if (!key) return false;
    
    const stringKey = typeof key === 'string' ? key : JSON.stringify(key);
    
    // Check local memory first
    const entry = this.cache.get(stringKey);
    if (entry && Date.now() - entry.timestamp <= this.ttl * 1000) {
      return true;
    }
    
    // If not in memory or expired, try Cloudflare KV
    try {
      const response = await axios.post(`${this.workerUrl}/cache/get`, {
        key: stringKey
      });
      
      return !!response.data.value;
    } catch (error) {
      console.error("Failed to check existence in Cloudflare KV cache:", error.message);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    const memoryStats = {
      size: this.cache.size,
      valid: 0
    };
    
    const now = Date.now();
    
    this.cache.forEach(entry => {
      if (now - entry.timestamp <= this.ttl * 1000) {
        memoryStats.valid++;
      }
    });
    
    return {
      memory: memoryStats,
      // Note: Cloudflare KV doesn't provide easy statistics access through the API
    };
  }
}

module.exports = PersistentCache;
