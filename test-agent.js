// Simple test script for interacting with the customer support agent
const axios = require('axios');

// Configuration
const API_URL = 'http://127.0.0.1:1880/customer-support';

// Sample Ukrainian queries to test
const ukrainianQueries = [
  'Як я можу змінити свій пароль?',
  'Чи можете ви пояснити, як підключитися до вашого API?',
  'Які документи потрібні для реєстрації?',
  'Де я можу знайти документацію про ваш продукт?',
  'Як мені отримати допомогу з налаштуванням програми?'
];

// Function to send a query and display the response
async function testQuery(query) {
  console.log(`\n----- Testing query: "${query}" -----`);
  
  try {
    console.time('Response time');
    const response = await axios.post(API_URL, { message: query });
    console.timeEnd('Response time');
    
    if (response.data && response.data.status === 'success') {
      console.log('\nResponse:');
      console.log(response.data.response);
      
      if (response.data.sources && response.data.sources.length > 0) {
        console.log('\nSources:');
        response.data.sources.forEach((source, index) => {
          console.log(`${index + 1}. ${source.filename} (score: ${source.score.toFixed(2)})`);
        });
      }
    } else {
      console.log('Error in response:', response.data);
    }
  } catch (error) {
    console.error('Error sending request:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
  
  console.log('\n' + '-'.repeat(50));
}

// Run all tests sequentially
async function runTests() {
  console.log('Starting customer support agent test with Ukrainian queries...');
  
  for (const query of ukrainianQueries) {
    await testQuery(query);
    // Wait a bit between queries
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\nAll tests completed!');
}

// Allow running a single query from command line
if (process.argv.length > 2) {
  const customQuery = process.argv.slice(2).join(' ');
  testQuery(customQuery);
} else {
  // Run all sample queries
  runTests();
}
