/**
 * One-time script to add 'admin' label to a user
 *
 * Usage:
 *   npx ts-node scripts/setAdminLabel.ts <userId> <appwriteApiKey>
 *
 * Example:
 *   npx ts-node scripts/setAdminLabel.ts user_123 your_api_key
 *
 * Get the userId from the Appwrite console or use the email to find the user first.
 */

import { Client, Users } from 'node-appwrite';

async function setAdminLabel() {
  const userId = process.argv[2];
  const apiKey = process.argv[3];

  if (!userId || !apiKey) {
    console.error('❌ Missing required arguments');
    console.log('\nUsage:');
    console.log('  npx ts-node scripts/setAdminLabel.ts <userId> <apiKey>');
    console.log('\nExample:');
    console.log('  npx ts-node scripts/setAdminLabel.ts 6571c04c5c4a5d2e8f1e4a9b your_api_key');
    console.log('\nTo get the API key:');
    console.log('  1. Go to https://cloud.appwrite.io/console');
    console.log('  2. Navigate to Settings → API Keys');
    console.log('  3. Create a new API key with Users scope');
    process.exit(1);
  }

  try {
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_API_ENDPOINT || 'https://cloud.appwrite.io/v1')
      .setProject(process.env.APPWRITE_PROJECT_ID || '')
      .setKey(apiKey);

    const users = new Users(client);

    console.log(`📋 Fetching user ${userId}...`);
    const user = await users.get(userId);

    console.log(`✅ Found user: ${user.email}`);
    console.log(`📝 Current labels: ${(user.labels || []).join(', ') || 'none'}`);

    // Get current labels
    const currentLabels = (user.labels || []) as string[];

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
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    console.error('\nTroubleshooting:');
    console.error('1. Make sure the API key has "Users" scope');
    console.error('2. Make sure the userId is correct');
    console.error('3. Make sure APPWRITE_API_ENDPOINT and APPWRITE_PROJECT_ID are set if not using defaults');
    process.exit(1);
  }
}

setAdminLabel();
