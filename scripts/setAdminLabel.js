/**
 * One-time script to add 'admin' label to a user (JavaScript version)
 *
 * Usage:
 *   node scripts/setAdminLabel.js <userId> <projectId> <appwriteApiKey>
 *
 * Example:
 *   node scripts/setAdminLabel.js 68d28b6b0028ea8966c9 my_project_id your_api_key
 *
 * Or use environment variables:
 *   export APPWRITE_PROJECT_ID=my_project_id
 *   node scripts/setAdminLabel.js 68d28b6b0028ea8966c9 your_api_key
 */

const { Client, Users } = require('node-appwrite');

async function setAdminLabel() {
  const userId = process.argv[2];
  const projectIdOrApiKey = process.argv[3];
  const apiKeyArg = process.argv[4];

  // Handle both 2-arg and 3-arg format
  let projectId, apiKey;

  if (apiKeyArg) {
    // 3-arg format: userId projectId apiKey
    projectId = projectIdOrApiKey;
    apiKey = apiKeyArg;
  } else {
    // 2-arg format: userId apiKey (use env for projectId)
    projectId = process.env.APPWRITE_PROJECT_ID;
    apiKey = projectIdOrApiKey;
  }

  if (!userId || !apiKey || !projectId) {
    console.error('❌ Missing required arguments');
    console.log('\n📝 Usage Option 1 (with explicit Project ID):');
    console.log('  node scripts/setAdminLabel.js <userId> <projectId> <apiKey>');
    console.log('\n📝 Usage Option 2 (with environment variable):');
    console.log('  export APPWRITE_PROJECT_ID=your_project_id');
    console.log('  node scripts/setAdminLabel.js <userId> <apiKey>');
    console.log('\n📋 Where to find these values:');
    console.log('  1. Go to https://cloud.appwrite.io/console');
    console.log('  2. Project ID: In the URL or Settings → General');
    console.log('  3. User ID: Auth → Users → [Select User]');
    console.log('  4. API Key: Settings → API Keys (needs users.read + users.write)');
    console.log('\n💡 Example:');
    console.log('  node scripts/setAdminLabel.js 68d28b6b0028ea8966c9 my_project_123 standard_abc123...');
    console.log('\n💡 Or with environment:');
    console.log('  export APPWRITE_PROJECT_ID=my_project_123');
    console.log('  node scripts/setAdminLabel.js 68d28b6b0028ea8966c9 standard_abc123...');
    process.exit(1);
  }

  try {
    console.log('🔧 Initializing Appwrite client...');
    console.log(`   Project ID: ${projectId}`);
    console.log(`   Endpoint: https://cloud.appwrite.io/v1`);

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_API_ENDPOINT || 'https://cloud.appwrite.io/v1')
      .setProject(projectId)
      .setKey(apiKey);

    const users = new Users(client);

    console.log(`📋 Fetching user ${userId}...`);
    const user = await users.get(userId);

    console.log(`✅ Found user: ${user.email}`);
    console.log(`📝 Current labels: ${(user.labels || []).join(', ') || 'none'}`);

    // Get current labels
    const currentLabels = user.labels || [];

    // Check if already admin
    if (currentLabels.includes('admin')) {
      console.log('✅ User is already an admin!');
      process.exit(0);
    }

    // Add 'admin' label
    const newLabels = [...currentLabels, 'admin'];

    console.log(`🔄 Adding 'admin' label...`);
    await users.updateLabels(userId, newLabels);

    console.log(`✅ Successfully added 'admin' label to user ${user.email}`);
    console.log(`📝 New labels: ${newLabels.join(', ')}`);
    console.log('\n✅ User is now an admin!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message || String(error));
    console.error('\nTroubleshooting:');
    console.error('1. Make sure the API key has "Users" scope');
    console.error('2. Make sure the userId is correct');
    console.error('3. Make sure APPWRITE_API_ENDPOINT and APPWRITE_PROJECT_ID are set if not using defaults');
    console.error('\nFull error:');
    console.error(error);
    process.exit(1);
  }
}

setAdminLabel();
