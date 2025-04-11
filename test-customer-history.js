/**
 * Test script for customer profile management and conversation history
 * Tests the ability to maintain context across multiple queries
 */

const axios = require('axios');

// Configuration
const SERVER_URL = 'http://localhost:1883';
const API_ENDPOINT = '/customer-support';
const TEST_EMAIL = 'test.customer@example.com';
const TEST_NAME = 'Test Customer';

// Create an axios instance with timeout
const client = axios.create({
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json'
  }
});

// Helper function to make API requests with customer information
async function sendQuery(message, email = TEST_EMAIL, name = TEST_NAME) {
  try {
    console.log(`\n🔹 Sending query: "${message}"`);
    
    const response = await client.post(`${SERVER_URL}${API_ENDPOINT}`, {
      message: message,
      email: email,
      name: name
    });
    
    return response.data;
  } catch (error) {
    console.error('Error making request:', error.message);
    if (error.response) {
      console.error('Response error data:', error.response.data);
    }
    throw error;
  }
}

// Helper to display response
function displayResponse(responseData) {
  console.log('\n📝 Response:');
  console.log(responseData.response);
  
  if (responseData.sources && responseData.sources.length > 0) {
    console.log('\n📚 Sources:');
    responseData.sources.forEach(source => {
      console.log(`  - ${source.filename} (confidence: ${source.score.toFixed(2)})`);
    });
  }
  
  console.log('\n💬 Conversation ID:', responseData.conversationId || 'Not provided');
  console.log('--------------------------------------------------');
}

// Run a sequence of related queries to test conversation context
async function runContextTest() {
  console.log('🔍 TESTING CUSTOMER SUPPORT CONVERSATION HISTORY');
  console.log('==================================================');
  console.log(`Customer: ${TEST_NAME} (${TEST_EMAIL})`);
  console.log('==================================================\n');
  
  try {
    // Query 1: Initial question
    console.log('TEST 1: Initial Question');
    let response = await sendQuery('Як створити новий квиток у Checkbox?');
    displayResponse(response);
    
    // Wait a moment between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Query 2: Follow-up question that requires context from previous query
    console.log('TEST 2: Follow-up Question (using context)');
    response = await sendQuery('А які поля потрібно заповнити?');
    displayResponse(response);
    
    // Wait a moment between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Query 3: Another follow-up with more specific question
    console.log('TEST 3: More Specific Follow-up');
    response = await sendQuery('Чи можу я додати файли до квитка?');
    displayResponse(response);
    
    console.log('\n✅ Context Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the context test
runContextTest();
