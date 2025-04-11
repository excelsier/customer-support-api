/**
 * Enhanced Cache System for Customer Support
 * Includes pre-warming for common queries and scheduled cleanup
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class EnhancedCache {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || path.join(__dirname, 'cache');
    this.maxCacheSize = options.maxCacheSize || 1000; // Maximum number of cache entries
    this.ttl = options.ttl || 24 * 60 * 60 * 1000; // 24 hours default TTL
    this.minCleanInterval = options.minCleanInterval || 60 * 60 * 1000; // 1 hour minimum clean interval
    this.commonQueriesFile = options.commonQueriesFile || path.join(__dirname, 'common-queries.json');
    
    this.memoryCache = new Map();
    this.lastCleanTime = Date.now();

    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    
    // Load from disk on startup
    this._loadFromDisk();
    
    // Start cleanup scheduler
    this._scheduleCleanup();
  }
  
  /**
   * Get a cache key for a query
   * @private
   */
  _getCacheKey(query) {
    return crypto.createHash('md5').update(typeof query === 'string' ? query : JSON.stringify(query)).digest('hex');
  }
  
  /**
   * Get cache path for a key
   * @private
   */
  _getCachePath(key) {
    return path.join(this.cacheDir, `${key}.json`);
  }
  
  /**
   * Load cache from disk
   * @private
   */
  _loadFromDisk() {
    try {
      const files = fs.readdirSync(this.cacheDir);
      
      // Load each cache file into memory
      files.forEach(file => {
        if (file.endsWith('.json')) {
          const key = file.replace('.json', '');
          const cachePath = path.join(this.cacheDir, file);
          
          try {
            const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            if (cacheData && cacheData.timestamp) {
              // Only load if not expired
              if (Date.now() - cacheData.timestamp < this.ttl) {
                this.memoryCache.set(key, cacheData);
              } else {
                // Delete expired file
                fs.unlinkSync(cachePath);
              }
            }
          } catch (err) {
            // Skip invalid cache files
            console.error(`Error loading cache file ${file}:`, err.message);
          }
        }
      });
      
      console.log(`Loaded ${this.memoryCache.size} items into cache from disk`);
    } catch (err) {
      console.error('Error loading cache from disk:', err.message);
    }
  }
  
  /**
   * Save individual cache entry to disk
   * @private
   */
  _saveToDisk(key, data) {
    try {
      const cachePath = this._getCachePath(key);
      fs.writeFileSync(cachePath, JSON.stringify(data));
    } catch (err) {
      console.error(`Error saving cache entry ${key} to disk:`, err.message);
    }
  }
  
  /**
   * Schedule periodic cache cleanup
   * @private
   */
  _scheduleCleanup() {
    // Run cleanup every hour
    setInterval(() => this.cleanup(), this.minCleanInterval);
  }
  
  /**
   * Set a value in the cache
   * @param {String|Object} query - The query to cache
   * @param {*} value - The value to cache
   * @param {Number} ttl - Optional custom TTL in milliseconds
   * @returns {Boolean} Success status
   */
  set(query, value, ttl = null) {
    const key = this._getCacheKey(query);
    const cacheEntry = {
      query,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.ttl,
      hits: 0
    };
    
    this.memoryCache.set(key, cacheEntry);
    this._saveToDisk(key, cacheEntry);
    
    // Clean cache if it's grown too large
    if (this.memoryCache.size > this.maxCacheSize) {
      this.cleanup();
    }
    
    return true;
  }
  
  /**
   * Get a value from the cache
   * @param {String|Object} query - The query to retrieve
   * @returns {*} The cached value or null if not found/expired
   */
  get(query) {
    const key = this._getCacheKey(query);
    
    if (this.memoryCache.has(key)) {
      const cacheEntry = this.memoryCache.get(key);
      
      // Check if entry has expired
      if (Date.now() - cacheEntry.timestamp > cacheEntry.ttl) {
        this.memoryCache.delete(key);
        try {
          fs.unlinkSync(this._getCachePath(key));
        } catch (err) {
          // Ignore errors when deleting
        }
        return null;
      }
      
      // Update hit count
      cacheEntry.hits++;
      
      return cacheEntry.value;
    }
    
    return null;
  }
  
  /**
   * Check if a query exists in the cache
   * @param {String|Object} query - The query to check
   * @returns {Boolean} True if cached and not expired
   */
  has(query) {
    const key = this._getCacheKey(query);
    
    if (this.memoryCache.has(key)) {
      const cacheEntry = this.memoryCache.get(key);
      
      // Check if entry has expired
      if (Date.now() - cacheEntry.timestamp > cacheEntry.ttl) {
        this.memoryCache.delete(key);
        try {
          fs.unlinkSync(this._getCachePath(key));
        } catch (err) {
          // Ignore errors when deleting
        }
        return false;
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Delete a query from the cache
   * @param {String|Object} query - The query to delete
   * @returns {Boolean} True if deleted, false if not found
   */
  delete(query) {
    const key = this._getCacheKey(query);
    
    if (this.memoryCache.has(key)) {
      this.memoryCache.delete(key);
      
      try {
        fs.unlinkSync(this._getCachePath(key));
      } catch (err) {
        // Ignore errors when deleting
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Clean up expired and least used cache entries
   * @param {Number} maxEntriesToKeep - Maximum number of entries to keep, defaults to maxCacheSize
   * @returns {Number} Number of entries removed
   */
  cleanup(maxEntriesToKeep = null) {
    const now = Date.now();
    
    // Only clean if enough time has passed since last cleanup
    if (now - this.lastCleanTime < this.minCleanInterval) {
      return 0;
    }
    
    this.lastCleanTime = now;
    let entriesRemoved = 0;
    
    // Step 1: Remove expired entries
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
        try {
          fs.unlinkSync(this._getCachePath(key));
        } catch (err) {
          // Ignore errors when deleting
        }
        entriesRemoved++;
      }
    }
    
    // Step 2: If still too many entries, remove least recently used
    const keepCount = maxEntriesToKeep || this.maxCacheSize;
    if (this.memoryCache.size > keepCount) {
      // Convert to array for sorting
      const entries = Array.from(this.memoryCache.entries())
        .map(([key, entry]) => ({
          key,
          entry,
          score: (entry.hits * 10) + (now - entry.timestamp) / 1000 // Weight hits more heavily
        }))
        .sort((a, b) => b.score - a.score); // Sort by score descending
      
      // Keep only the top entries
      const entriesToRemove = entries.slice(keepCount);
      
      // Remove excess entries
      for (const { key } of entriesToRemove) {
        this.memoryCache.delete(key);
        try {
          fs.unlinkSync(this._getCachePath(key));
        } catch (err) {
          // Ignore errors when deleting
        }
        entriesRemoved++;
      }
    }
    
    console.log(`Cache cleanup complete: removed ${entriesRemoved} entries, kept ${this.memoryCache.size}`);
    return entriesRemoved;
  }
  
  /**
   * Pre-warm the cache with common queries
   * @param {Function} requestFn - Function to execute to warm the cache for a query
   * @returns {Promise<Number>} Number of queries pre-warmed
   */
  async preWarmCache(requestFn) {
    try {
      // Load common queries from file
      let commonQueries = [];
      
      if (fs.existsSync(this.commonQueriesFile)) {
        commonQueries = JSON.parse(fs.readFileSync(this.commonQueriesFile, 'utf8'));
      } else {
        console.log('Common queries file not found, skipping pre-warming');
        return 0;
      }
      
      // Filter out queries already in cache
      const queriesToWarm = commonQueries.filter(q => !this.has(q));
      
      console.log(`Pre-warming cache with ${queriesToWarm.length} common queries`);
      
      // Process each query
      let warmed = 0;
      for (const query of queriesToWarm) {
        try {
          // Execute the request function
          const result = await requestFn(query);
          
          // Store in cache
          this.set(query, result);
          
          warmed++;
          console.log(`Pre-warmed cache for query: ${query}`);
        } catch (err) {
          console.error(`Error pre-warming cache for query "${query}":`, err.message);
        }
        
        // Small delay between requests to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      return warmed;
    } catch (err) {
      console.error('Error pre-warming cache:', err.message);
      return 0;
    }
  }
  
  /**
   * Record a common query to improve pre-warming
   * @param {String} query - The query to record
   * @param {Boolean} successful - Whether the query was successful
   */
  recordCommonQuery(query, successful = true) {
    if (!successful || !query) return;
    
    try {
      // Load existing common queries
      let commonQueries = [];
      if (fs.existsSync(this.commonQueriesFile)) {
        commonQueries = JSON.parse(fs.readFileSync(this.commonQueriesFile, 'utf8'));
      }
      
      // Add query if not already in the list
      if (!commonQueries.includes(query)) {
        commonQueries.push(query);
        
        // Save updated list (limit to 100 queries)
        fs.writeFileSync(
          this.commonQueriesFile, 
          JSON.stringify(commonQueries.slice(-100), null, 2)
        );
      }
    } catch (err) {
      console.error('Error recording common query:', err.message);
    }
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    
    // Count expired entries
    for (const entry of this.memoryCache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredCount++;
      }
    }
    
    return {
      total: this.memoryCache.size,
      expired: expiredCount,
      valid: this.memoryCache.size - expiredCount,
      lastCleanup: new Date(this.lastCleanTime).toISOString()
    };
  }
}

// Export cache class
module.exports = EnhancedCache;
