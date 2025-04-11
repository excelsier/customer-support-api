/**
 * Performance test for Customer Support Agent
 * Measures response time for various queries
 */

const axios = require('axios');

// Configuration
const SERVER_URL = 'http://localhost:1881';
const API_ENDPOINT = '/customer-support';
const TEST_EMAIL = 'performance.test@example.com';
const TEST_NAME = 'Performance Test User';
const TEST_RUNS = 5; // Number of times to run each test

// Test queries (Ukrainian)
const TEST_QUERIES = [
  'Як створити новий квиток у Checkbox?',
  'Як налаштувати авторизацію в API Checkbox?',
  'Що таке Checkbox?',
  'Які платіжні методи підтримує Checkbox?',
  'Як отримати історію транзакцій через API?'
];

// Create an axios instance with extended timeout
const client = axios.create({
  timeout: 60000, // 60 second timeout
  headers: {
    'Content-Type': 'application/json'
  }
});

// Helper function to make API requests
async function sendQuery(message, email = TEST_EMAIL, name = TEST_NAME) {
  try {
    console.log(`Sending query: "${message}"`);
    const startTime = Date.now();
    
    const response = await client.post(`${SERVER_URL}${API_ENDPOINT}`, {
      message: message,
      email: email,
      name: name
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    return {
      responseData: response.data,
      duration: duration
    };
  } catch (error) {
    console.error('Error making request:', error.message);
    if (error.response) {
      console.error('Response error data:', error.response.data);
    }
    throw error;
  }
}

// Function to run performance tests
async function runPerformanceTests() {
  console.log('🔍 CUSTOMER SUPPORT PERFORMANCE TEST');
  console.log('=====================================');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Testing ${TEST_QUERIES.length} queries, ${TEST_RUNS} runs each`);
  console.log('=====================================\n');
  
  const results = [];
  
  // First run - warm up cache and establish connections
  console.log('🔥 Warm-up run:');
  try {
    await sendQuery('Привіт, це тестове повідомлення');
    console.log('✅ Warm-up complete\n');
  } catch (error) {
    console.error('❌ Warm-up failed, continuing with tests\n');
  }
  
  // Run tests for each query
  for (const query of TEST_QUERIES) {
    const queryResults = [];
    
    console.log(`📊 Testing query: "${query}"`);
    
    for (let i = 0; i < TEST_RUNS; i++) {
      try {
        console.log(`  Run ${i + 1}/${TEST_RUNS}...`);
        const result = await sendQuery(query);
        queryResults.push(result.duration);
        console.log(`  ✓ ${result.duration}ms`);
        
        // Brief delay between runs
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`  ✗ Run ${i + 1} failed: ${error.message}`);
        queryResults.push(null);
      }
    }
    
    // Calculate statistics
    const validResults = queryResults.filter(r => r !== null);
    if (validResults.length > 0) {
      const avg = validResults.reduce((a, b) => a + b, 0) / validResults.length;
      const min = Math.min(...validResults);
      const max = Math.max(...validResults);
      
      results.push({
        query,
        runs: TEST_RUNS,
        successful: validResults.length,
        averageMs: avg,
        minMs: min,
        maxMs: max
      });
      
      console.log(`  Average: ${avg.toFixed(0)}ms (min: ${min}ms, max: ${max}ms)\n`);
    } else {
      console.log(`  All runs failed for this query\n`);
      results.push({
        query,
        runs: TEST_RUNS,
        successful: 0,
        averageMs: null,
        minMs: null,
        maxMs: null
      });
    }
  }
  
  // Display summary
  console.log('📋 PERFORMANCE TEST SUMMARY');
  console.log('===========================');
  
  let totalAvg = 0;
  let totalSuccessful = 0;
  let totalRuns = 0;
  
  for (const result of results) {
    if (result.successful > 0) {
      totalAvg += result.averageMs * result.successful;
      totalSuccessful += result.successful;
    }
    totalRuns += result.runs;
    
    console.log(`Query: "${result.query}"`);
    if (result.successful > 0) {
      console.log(`  Avg: ${result.averageMs.toFixed(0)}ms (${result.successful}/${result.runs} successful)`);
    } else {
      console.log(`  All ${result.runs} runs failed`);
    }
  }
  
  if (totalSuccessful > 0) {
    const overallAvg = totalAvg / totalSuccessful;
    console.log('\n🕒 Overall average response time:');
    console.log(`  ${overallAvg.toFixed(0)}ms (${totalSuccessful}/${totalRuns} successful)`);
  }
  
  console.log('\n✅ Performance test complete');
}

// Run the performance tests
runPerformanceTests();
