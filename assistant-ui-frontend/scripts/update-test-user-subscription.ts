/**
 * Script to manually update test user subscription status
 * Run with: npx tsx scripts/update-test-user-subscription.ts
 */

import { Client, Databases, Query } from 'appwrite';

const client = new Client();
client
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('68adb98e0020be2e134f');

// Set API key for admin access
const apiKey = 'standard_929c5f632b2d4e1e4e787dddb6e4fa2dfc185d1ed56c573ed8e8b563790cfa6bf2b380eb0ab45875053a1c69c00e970e34e4bb9d21f076149e3ea04b7b22bf38427d9e05c74c3c7168618f5894b628a3c76c0987f7a4926ed853640637da1eb0e799a1a7b85ddc44933d2b6318e9a93fc9e14ab9bec7b1b579233adc7f490acd';
client.headers['X-Appwrite-Key'] = apiKey;

const databases = new Databases(client);

async function updateTestUserSubscription() {
  try {
    // List all students to see structure
    console.log('Listing all students...');
    const allStudents = await databases.listDocuments(
      'default',
      'students',
      [Query.limit(5)]
    );

    console.log('Total students:', allStudents.total);
    console.log('Students:', JSON.stringify(allStudents.documents, null, 2));

    // Get test user by document ID (from checkout session client_reference_id)
    const studentDocId = '68d28c190016b1458092';
    console.log('\nGetting student by document ID:', studentDocId);
    const student = await databases.getDocument('default', 'students', studentDocId);

    console.log('Found student:', {
      id: student.$id,
      userId: student.userId,
      currentStatus: student.subscriptionStatus
    });

    // Update subscription status
    console.log('Updating subscription status to active...');
    await databases.updateDocument(
      'default',
      'students',
      student.$id,
      {
        subscriptionStatus: 'active',
        stripeCustomerId: 'cus_TQGj6ESsB4c0se', // From the checkout session
        stripeSubscriptionId: 'sub_1STQBaFRU60i929lQ3E8IQIA', // From the checkout session
        subscriptionExpiresAt: null
      }
    );

    console.log('✅ Successfully updated subscription status to active!');
  } catch (error) {
    console.error('Error updating subscription:', error);
  }
}

updateTestUserSubscription();
