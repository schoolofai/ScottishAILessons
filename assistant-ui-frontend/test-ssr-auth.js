const { Client, Account } = require('node-appwrite');
require('dotenv').config();

// Create admin client (similar to createAdminClient)
function createAdminClient() {
    const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    return {
        client,
        account: new Account(client)
    };
}

// Create session client (similar to createSessionClient)
function createSessionClient(sessionSecret) {
    console.log('Creating session client with secret:', sessionSecret ? sessionSecret.substring(0, 10) + '...' : 'NO_SECRET');

    const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);

    if (sessionSecret) {
        client.setSession(sessionSecret);
    }

    return {
        client,
        account: new Account(client)
    };
}

async function testSSRAuthentication() {
    try {
        console.log('=== Testing SSR Authentication Pattern ===');

        // Step 1: Use admin client to create session (simulating /signin route)
        console.log('\n1. Creating admin client...');
        const { account: adminAccount } = createAdminClient();

        console.log('2. Creating email/password session with admin client...');
        const session = await adminAccount.createEmailPasswordSession(
            'testuser2@scottishailessons.com',
            'testpass123'
        );

        console.log('3. Session created:', {
            sessionId: session.$id,
            userId: session.userId,
            secretExists: !!session.secret,
            secretLength: session.secret ? session.secret.length : 0,
            secretPreview: session.secret ? session.secret.substring(0, 20) + '...' : 'EMPTY',
            expire: session.expire
        });

        // Step 2: Use session client with the session secret (simulating authenticated request)
        console.log('\n4. Creating session client with session secret...');
        const { account: sessionAccount } = createSessionClient(session.secret);

        console.log('5. Testing authentication with session client...');
        const user = await sessionAccount.get();

        console.log('6. Successfully authenticated as:', {
            id: user.$id,
            email: user.email,
            name: user.name,
            labels: user.labels
        });

        console.log('\n=== SUCCESS: SSR Authentication Working! ===');
        return { session, user };

    } catch (error) {
        console.error('\n=== FAILED: SSR Authentication Error ===');
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            type: error.type
        });
        throw error;
    }
}

// Run the test
if (require.main === module) {
    testSSRAuthentication()
        .then((result) => {
            console.log('\nTest completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\nTest failed!');
            process.exit(1);
        });
}

module.exports = { testSSRAuthentication, createAdminClient, createSessionClient };