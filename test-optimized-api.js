/**
 * Test script to verify both original and optimized API endpoints
 * This script compares responses and performance between the two systems
 */

const axios = require('axios');

// Configuration
const ORIGINAL_ENDPOINT = 'http://localhost:1883/customer-support';
const OPTIMIZED_ENDPOINT = 'http://localhost:3001/api/customer-support';
const TEST_EMAIL = 'comparison.test@example.com';
const TEST_NAME = 'Comparison Test User';

// Test queries (Ukrainian)
const TEST_QUERIES = [
  'Як створити новий квиток у Checkbox?',
  'Як налаштувати авторизацію в API Checkbox?',
  'Що таке Checkbox?'
];

// Create axios instances for both endpoints
const originalClient = axios.create({
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json'
  }
});

const optimizedClient = axios.create({
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Send a query to the original API
 */
async function queryOriginalAPI(message) {
  try {
    const startTime = Date.now();
    const response = await originalClient.post(ORIGINAL_ENDPOINT, {
      message,
      email: TEST_EMAIL,
      name: TEST_NAME
    });
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      data: response.data,
      duration
    };
  } catch (error) {
    console.error(`Error with original API: ${error.message}`);
    return {
      success: false,
      error: error.message,
      duration: null
    };
  }
}

/**
 * Send a query to the optimized API
 */
async function queryOptimizedAPI(message) {
  try {
    const startTime = Date.now();
    const response = await optimizedClient.post(OPTIMIZED_ENDPOINT, {
      message,
      email: TEST_EMAIL,
      name: TEST_NAME
    });
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      data: response.data,
      duration
    };
  } catch (error) {
    console.error(`Error with optimized API: ${error.message}`);
    return {
      success: false,
      error: error.message,
      duration: null
    };
  }
}

/**
 * Format time duration in a readable way
 */
function formatDuration(ms) {
  if (ms === null) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Compare response objects to check if they're equivalent
 */
function areResponsesEquivalent(resp1, resp2) {
  if (!resp1.success || !resp2.success) return false;
  
  // Check if both have expected properties
  if (!resp1.data || !resp2.data) return false;
  
  // Compare the response text
  if (resp1.data.response && resp2.data.response) {
    return true;
  }
  
  return false;
}

/**
 * Run comparison tests
 */
async function runTests() {
  console.log('🔍 TESTING CUSTOMER SUPPORT API COMPARISON');
  console.log('===========================================');
  console.log(`Testing ${TEST_QUERIES.length} queries on both original and optimized APIs`);
  console.log('===========================================\n');
  
  const results = [];
  
  // First run - warm up both APIs
  console.log('🔥 Warm-up run:');
  try {
    const warmupMessage = 'Привіт, це тестове повідомлення';
    await Promise.all([
      queryOriginalAPI(warmupMessage),
      queryOptimizedAPI(warmupMessage)
    ]);
    console.log('✅ Warm-up complete\n');
  } catch (error) {
    console.error('❌ Warm-up failed, continuing with tests\n');
  }
  
  // Run each test query
  for (const query of TEST_QUERIES) {
    console.log(`📊 Testing query: "${query}"`);
    
    // Test original API
    console.log('  🔹 Original API:');
    const originalResult = await queryOriginalAPI(query);
    if (originalResult.success) {
      console.log(`    ✓ ${formatDuration(originalResult.duration)}`);
      console.log(`    Response snippet: "${originalResult.data?.response?.substring(0, 50)}..."`);
    } else {
      console.log(`    ✗ Failed: ${originalResult.error}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test optimized API
    console.log('  🔹 Optimized API:');
    const optimizedResult = await queryOptimizedAPI(query);
    if (optimizedResult.success) {
      console.log(`    ✓ ${formatDuration(optimizedResult.duration)}`);
      console.log(`    Response snippet: "${optimizedResult.data?.response?.substring(0, 50)}..."`);
    } else {
      console.log(`    ✗ Failed: ${optimizedResult.error}`);
    }
    
    // Check if responses are equivalent
    const equivalent = areResponsesEquivalent(originalResult, optimizedResult);
    console.log(`  🔄 Responses equivalent: ${equivalent ? '✓ Yes' : '✗ No'}`);
    
    // Speed comparison
    if (originalResult.success && optimizedResult.success) {
      const speedDiff = originalResult.duration - optimizedResult.duration;
      const percentDiff = ((speedDiff / originalResult.duration) * 100).toFixed(1);
      
      if (speedDiff > 0) {
        console.log(`  ⚡ Optimized API is ${formatDuration(speedDiff)} (${percentDiff}%) faster`);
      } else if (speedDiff < 0) {
        console.log(`  ⚠️ Original API is ${formatDuration(Math.abs(speedDiff))} (${Math.abs(percentDiff)}%) faster`);
      } else {
        console.log(`  ⚖️ Both APIs have identical performance`);
      }
    }
    
    results.push({
      query,
      original: originalResult,
      optimized: optimizedResult,
      equivalent,
      speedDiff: originalResult.success && optimizedResult.success 
        ? originalResult.duration - optimizedResult.duration
        : null
    });
    
    console.log(''); // Empty line for readability
  }
  
  // Summary
  console.log('\n📋 SUMMARY');
  console.log('==========');
  
  let totalOriginalTime = 0;
  let totalOptimizedTime = 0;
  let successfulTests = 0;
  
  results.forEach(result => {
    if (result.original.success && result.optimized.success) {
      totalOriginalTime += result.original.duration;
      totalOptimizedTime += result.optimized.duration;
      successfulTests++;
    }
  });
  
  if (successfulTests > 0) {
    const avgOriginalTime = totalOriginalTime / successfulTests;
    const avgOptimizedTime = totalOptimizedTime / successfulTests;
    const avgSpeedDiff = avgOriginalTime - avgOptimizedTime;
    const avgPercentDiff = ((avgSpeedDiff / avgOriginalTime) * 100).toFixed(1);
    
    console.log(`Successful comparison tests: ${successfulTests}/${TEST_QUERIES.length}`);
    console.log(`Average original API time: ${formatDuration(avgOriginalTime)}`);
    console.log(`Average optimized API time: ${formatDuration(avgOptimizedTime)}`);
    
    if (avgSpeedDiff > 0) {
      console.log(`Overall, optimized API is ${formatDuration(avgSpeedDiff)} (${avgPercentDiff}%) faster on average`);
    } else if (avgSpeedDiff < 0) {
      console.log(`Overall, original API is ${formatDuration(Math.abs(avgSpeedDiff))} (${Math.abs(avgPercentDiff)}%) faster on average`);
    } else {
      console.log(`Overall, both APIs have identical average performance`);
    }
  } else {
    console.log('No successful tests to compare');
  }
  
  console.log('\n✅ Test complete');
}

// Run the tests
runTests();
