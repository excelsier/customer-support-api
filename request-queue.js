/**
 * Request Queue Manager for Customer Support System
 * Handles concurrent requests and prevents timeout issues
 */

class RequestQueue {
  constructor(options = {}) {
    this._maxConcurrent = options.maxConcurrent || 3;
    this.timeout = options.timeout || 60000; // 60 seconds default timeout
    this.queue = [];
    this.activeRequests = 0;
    this.requestMap = new Map(); // Maps request IDs to their state
  }
  
  /**
   * Get the maximum number of concurrent requests
   */
  get maxConcurrent() {
    return this._maxConcurrent;
  }
  
  /**
   * Set the maximum number of concurrent requests
   * @param {Number} value - New concurrency value
   */
  set maxConcurrent(value) {
    this._maxConcurrent = value;
    // Process queue with new concurrency limit
    this._processQueue();
  }

  /**
   * Add a request to the queue
   * @param {Function} requestFn - Function that returns a promise
   * @param {String} requestId - Unique identifier for this request
   * @param {Object} priority - Priority information (higher number = higher priority)
   * @returns {Promise} Promise that resolves with the request result
   */
  async enqueue(requestFn, requestId = null, priority = 0) {
    // Generate a request ID if none provided
    const reqId = requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Check if this request is already in queue or processing
    if (this.requestMap.has(reqId)) {
      // Return the existing promise
      return this.requestMap.get(reqId).promise;
    }
    
    // Create the promise that will be returned to the caller
    let resolveRequest, rejectRequest;
    const promise = new Promise((resolve, reject) => {
      resolveRequest = resolve;
      rejectRequest = reject;
    });
    
    // Create a request object
    const request = {
      id: reqId,
      fn: requestFn,
      priority: priority,
      promise,
      resolve: resolveRequest,
      reject: rejectRequest,
      enqueueTime: Date.now(),
      timeoutId: null
    };
    
    // Set timeout to prevent hanging requests
    request.timeoutId = setTimeout(() => {
      this._handleRequestTimeout(reqId);
    }, this.timeout);
    
    // Add to map
    this.requestMap.set(reqId, request);
    
    // Add to queue based on priority
    this._insertWithPriority(request);
    
    // Process queue if capacity available
    this._processQueue();
    
    return promise;
  }
  
  /**
   * Insert a request into the queue with priority
   * @private
   */
  _insertWithPriority(request) {
    // Find the right position based on priority
    let position = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (request.priority > this.queue[i].priority) {
        position = i;
        break;
      }
    }
    
    // Insert at the position
    this.queue.splice(position, 0, request);
  }
  
  /**
   * Process the next items in the queue if capacity is available
   * @private
   */
  async _processQueue() {
    // Process as many requests as we can based on maxConcurrent
    while (this.activeRequests < this._maxConcurrent && this.queue.length > 0) {
      const request = this.queue.shift();
      this.activeRequests++;
      
      // Process this request
      this._processRequest(request).finally(() => {
        this.activeRequests--;
        this._processQueue(); // Continue processing queue
      });
    }
  }
  
  /**
   * Process a single request
   * @private
   */
  async _processRequest(request) {
    try {
      // Execute the request function
      const result = await request.fn();
      
      // Clear the timeout
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      
      // Resolve the promise
      request.resolve(result);
      
      // Clean up
      this.requestMap.delete(request.id);
    } catch (error) {
      // Clear the timeout
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      
      // Reject the promise
      request.reject(error);
      
      // Clean up
      this.requestMap.delete(request.id);
    }
  }
  
  /**
   * Handle request timeout
   * @private
   */
  _handleRequestTimeout(requestId) {
    if (!this.requestMap.has(requestId)) return;
    
    const request = this.requestMap.get(requestId);
    const timeoutError = new Error(`Request ${requestId} timed out after ${this.timeout}ms`);
    
    // Remove from queue if still there
    const queueIndex = this.queue.findIndex(r => r.id === requestId);
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1);
    } else {
      // If not in queue, it's being processed, so decrease counter
      this.activeRequests--;
    }
    
    // Reject the promise
    request.reject(timeoutError);
    
    // Clean up
    this.requestMap.delete(requestId);
    
    // Process next items
    this._processQueue();
  }
  
  /**
   * Check if a request is already in the queue or processing
   * @param {String} requestId - The request ID to check
   * @returns {Boolean} True if request exists, false otherwise
   */
  hasRequest(requestId) {
    return this.requestMap.has(requestId);
  }
  
  /**
   * Get queue statistics
   * @returns {Object} Queue stats
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      totalRequests: this.requestMap.size
    };
  }
}

// Export singleton instance
const requestQueue = new RequestQueue();
module.exports = requestQueue;
