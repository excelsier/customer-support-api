/**
 * Optimization Manager for Customer Support System
 * Integrates request queue, cache system, and pre-warming functionality
 */

const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Import custom modules
const requestQueue = require('./request-queue');
const EnhancedCache = require('./enhanced-cache');

class OptimizationManager {
  constructor(options = {}) {
    this.serverUrl = options.serverUrl || 'http://localhost:1881';
    this.apiEndpoint = options.apiEndpoint || '/customer-support';
    this.preWarmEnabled = options.preWarmEnabled !== false;
    this.debugMode = options.debugMode || false;
    
    // Initialize cache with options
    this.cache = new EnhancedCache({
      cacheDir: options.cacheDir || path.join(__dirname, 'cache'),
      maxCacheSize: options.maxCacheSize || 1000,
      ttl: options.cacheTtl || 24 * 60 * 60 * 1000, // 24 hours
      minCleanInterval: options.cleanInterval || 60 * 60 * 1000 // 1 hour
    });
    
    // Use existing request queue
    this.queue = requestQueue;
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      lastRequest: null
    };
    
    this.log('Optimization Manager initialized');
    
    // Pre-warm cache if enabled
    if (this.preWarmEnabled) {
      this.preWarmCache();
    }
    
    // Schedule regular cache pre-warming (every 8 hours)
    setInterval(() => {
      if (this.preWarmEnabled) {
        this.preWarmCache();
      }
    }, 8 * 60 * 60 * 1000);
  }
  
  /**
   * Log a message with timestamp (if debug mode enabled)
   * @private
   */
  log(message) {
    if (this.debugMode) {
      console.log(`[${new Date().toISOString()}] OptimizationManager: ${message}`);
    }
  }
  
  /**
   * Pre-warm the cache with common queries
   * @returns {Promise<Number>} Number of queries pre-warmed
   */
  async preWarmCache() {
    this.log('Starting cache pre-warming...');
    
    // Reduce the number of concurrent pre-warming requests
    // Configure the request queue with lower concurrency for pre-warming
    this.queue.maxConcurrent = 2; // Limit to 2 concurrent requests during pre-warming
    
    // Split the pre-warming into batches to avoid overwhelming the system
    const warmed = await this.cache.preWarmCache(async (query) => {
      // Create a test user for cache warming
      const testUser = {
        name: 'Cache Warming System',
        email: 'cache.warming@system.internal'
      };
      
      // Create the request function with better error handling
      const requestFn = async () => {
        try {
          // Use a shorter timeout for pre-warming
          const response = await axios.post(`${this.serverUrl}${this.apiEndpoint}`, {
            message: query,
            email: testUser.email,
            name: testUser.name
          }, {
            timeout: 30000 // 30 second timeout for pre-warming (reduced from 60s)
          });
          
          return response.data;
        } catch (error) {
          this.log(`Error during pre-warming for query "${query}": ${error.message}`);
          // Instead of throwing, return a placeholder to prevent cache.preWarmCache from failing
          return {
            status: "error",
            response: "Cache pre-warming error: " + error.message,
            timestamp: new Date().toISOString(),
            _preWarmFailed: true // Mark this as a failed pre-warm
          };
        }
      };
      
      // Add some delay between requests (stagger them)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Use the queue to execute the request with a unique ID and lower priority
      const result = await this.queue.enqueue(
        requestFn, 
        `prewarm_${Date.now()}_${Math.random()}`, 
        -10 // Lower priority
      );
      
      // Don't cache failed pre-warming results
      if (result && result._preWarmFailed) {
        return null; // This tells cache.preWarmCache to skip this entry
      }
      
      return result;
    });
    
    // Restore normal concurrency after pre-warming
    this.queue.maxConcurrent = 3; // Reset to normal value
    
    this.log(`Cache pre-warming completed. Warmed ${warmed} queries.`);
    return warmed;
  }
  
  /**
   * Process a customer support request with optimizations
   * @param {Object} data - The request data (message, email, name)
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async processRequest(data, options = {}) {
    this.stats.totalRequests++;
    this.stats.lastRequest = new Date();
    
    // Generate cache key from request data
    const cacheKey = JSON.stringify({
      message: data.message,
      email: data.email
    });
    
    // Check cache first
    if (this.cache.has(cacheKey) && !options.skipCache) {
      this.stats.cacheHits++;
      this.log(`Cache hit for message: "${data.message}"`);
      return this.cache.get(cacheKey);
    }
    
    this.stats.cacheMisses++;
    this.log(`Cache miss for message: "${data.message}"`);
    
    // Create request ID for queuing
    const requestId = `req_${data.email}_${Date.now()}`;
    
    // Define priority (can be customized based on different factors)
    const priority = options.priority || 0;
    
    // Create the request function
    const requestFn = async () => {
      try {
        const startTime = Date.now();
        
        const response = await axios.post(`${this.serverUrl}${this.apiEndpoint}`, data, {
          timeout: options.timeout || 60000 // 60 second timeout
        });
        
        const duration = Date.now() - startTime;
        this.log(`Request completed in ${duration}ms: "${data.message}"`);
        
        // Store in cache
        if (response.data && response.status === 200) {
          this.cache.set(cacheKey, response.data);
          
          // Record as common query if successful
          this.cache.recordCommonQuery(data.message, true);
        }
        
        return response.data;
      } catch (error) {
        this.stats.errors++;
        this.log(`Error processing request: ${error.message}`);
        throw error;
      }
    };
    
    // Add to queue and wait for execution
    return this.queue.enqueue(requestFn, requestId, priority);
  }
  
  /**
   * Get a combined statistics report
   * @returns {Object} Statistics for queue, cache, and overall system
   */
  getStats() {
    return {
      requestProcessing: {
        totalRequests: this.stats.totalRequests,
        cacheHits: this.stats.cacheHits,
        cacheMisses: this.stats.cacheMisses,
        hitRate: this.stats.totalRequests > 0 
          ? (this.stats.cacheHits / this.stats.totalRequests) * 100 
          : 0,
        errors: this.stats.errors,
        lastRequest: this.stats.lastRequest
      },
      queue: this.queue.getStats(),
      cache: this.cache.getStats()
    };
  }
}

// Export the OptimizationManager class
module.exports = OptimizationManager;
