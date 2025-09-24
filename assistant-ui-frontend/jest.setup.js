// Load test environment variables
require('dotenv').config({ path: '.env.test' });

// Ensure test API key is set
if (!process.env.APPWRITE_API_KEY) {
  throw new Error('APPWRITE_API_KEY must be set for integration tests. Please check .env.test file.');
}

if (!process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT) {
  throw new Error('NEXT_PUBLIC_APPWRITE_ENDPOINT must be set for integration tests');
}

if (!process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID) {
  throw new Error('NEXT_PUBLIC_APPWRITE_PROJECT_ID must be set for integration tests');
}

console.log('Test environment initialized with Appwrite endpoint:', process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT);