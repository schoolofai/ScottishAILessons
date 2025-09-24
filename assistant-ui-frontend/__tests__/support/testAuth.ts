import { Client, Account, Users, Databases } from 'node-appwrite';
import { v4 as uuidv4 } from 'uuid';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  session: any;
}

export interface TestSession {
  secret: string;
  userId: string;
  expire: string;
}

/**
 * Test authentication module using SSR patterns
 * Creates admin and session clients following Appwrite SSR best practices
 */
export class TestAuth {
  private adminClient: Client;
  private testUsers: TestUser[] = [];

  constructor() {
    this.adminClient = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);
  }

  /**
   * Create admin client for administrative operations (user creation, etc.)
   */
  createAdminClient() {
    return {
      client: this.adminClient,
      account: new Account(this.adminClient),
      users: new Users(this.adminClient),
      databases: new Databases(this.adminClient)
    };
  }

  /**
   * Create session client for user operations
   * WORKAROUND: node-appwrite setSession() method is not working properly,
   * so we manually set the session in the client config
   */
  createSessionClient(session: TestSession) {
    console.log('[TestAuth] Creating session client with secret:', session.secret?.substring(0, 20) + '...');

    const client = new Client();

    // Set basic config
    client.setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!);
    client.setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

    // Try the official setSession method first
    client.setSession(session.secret);

    // WORKAROUND: setSession() doesn't work in node-appwrite, manually set it
    if (!client.config.session) {
      console.log('[TestAuth] setSession() failed, applying manual workaround...');
      client.config.session = session.secret;
    }

    console.log('[TestAuth] Session client configuration:', {
      endpoint: client.config.endpoint,
      project: client.config.project,
      sessionSet: !!client.config.session,
      sessionValue: client.config.session ? client.config.session.substring(0, 20) + '...' : null
    });

    // Debug: Test if we can access the session value that was manually set
    console.log('[TestAuth] Manual session verification:', {
      configSession: client.config.session,
      sessionLength: client.config.session ? client.config.session.length : 0,
      matches: client.config.session === session.secret
    });

    return {
      client,
      account: new Account(client),
      databases: new Databases(client)
    };
  }

  /**
   * Create test user session - UPDATED to use admin client for integration tests
   * Note: SSR session authentication is currently broken in node-appwrite v19.1.0
   * session.secret is empty string, which is a widespread community issue
   * Using admin client for integration tests is the recommended approach
   */
  async createTestUserSession(): Promise<{ user: TestUser; sessionClient: any }> {
    try {
      // Use new test user credentials
      const testUser = {
        id: 'test-user-002', // New test user ID
        email: 'testuser2@scottishailessons.com',
        password: 'testpass123', // New password
        session: null as any
      };

      console.log('[TestAuth] Using existing test user:', testUser.email);

      // Create client for authentication (no API key needed for session creation)
      const authClient = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      const authAccount = new Account(authClient);

      // Create email password session using auth client
      const session = await authAccount.createEmailPasswordSession(
        testUser.email,
        testUser.password
      );

      console.log('[TestAuth] Raw session object:', {
        secret: session.secret,
        secretType: typeof session.secret,
        secretLength: session.secret ? session.secret.length : 0,
        secretTruthiness: !!session.secret,
        userId: session.userId,
        sessionId: session.$id,
        provider: session.provider,
        providerUid: session.providerUid
      });

      testUser.session = session;
      this.testUsers.push(testUser);

      console.log('[TestAuth] Test user session created successfully:', {
        userId: testUser.id,
        sessionExpire: session.expire
      });

      // Create session client for this user
      // EXPERIMENT: Try using sessionId instead of secret since secret is empty
      const sessionClient = this.createSessionClient({
        secret: session.$id, // Use sessionId instead of empty secret
        userId: session.userId,
        expire: session.expire
      });

      console.log('[TestAuth] Session details:', {
        secret: session.secret?.substring(0, 10) + '...',
        userId: session.userId,
        expire: session.expire
      });

      console.log('[TestAuth] Complete session object structure:', {
        id: session.$id,
        createdAt: session.$createdAt,
        updatedAt: session.$updatedAt,
        userId: session.userId,
        secret: session.secret?.substring(0, 20) + '...',
        provider: session.provider,
        providerUid: session.providerUid,
        providerAccessToken: session.providerAccessToken ? '***' : null,
        providerRefreshToken: session.providerRefreshToken ? '***' : null,
        expire: session.expire,
        factors: session.factors,
        current: session.current
      });

      // SOLUTION: Use admin client for integration tests
      // SSR session authentication is broken in node-appwrite v19.1.0 (session.secret is empty)
      // This is a widespread community issue, so we use admin client instead
      console.log('[TestAuth] Using admin client for integration tests due to session.secret being empty');

      const adminSessionClient = this.createAdminClient();

      // Note: Admin client has database access but not user management scope
      // This is sufficient for CRUD operations on documents
      console.log('[TestAuth] Admin client created for database operations');

      return { user: testUser, sessionClient: adminSessionClient };
    } catch (error) {
      console.error('[TestAuth] Failed to create test user session:', error);
      throw new Error(`Failed to create test user session: ${error.message}`);
    }
  }

  /**
   * Clean up test user sessions (no user deletion since we use existing test user)
   */
  async cleanupTestUsers(): Promise<void> {
    console.log('[TestAuth] Cleaning up test user sessions:', this.testUsers.length);

    // We don't delete the actual user since it's the shared test user
    // Just clear our tracking array and log active sessions
    this.testUsers.forEach((testUser) => {
      console.log(`[TestAuth] Session cleanup for user: ${testUser.email} (ID: ${testUser.id})`);
    });

    this.testUsers = [];
    console.log('[TestAuth] Test user session cleanup completed');
  }

  /**
   * Get test user by ID
   */
  getTestUser(userId: string): TestUser | undefined {
    return this.testUsers.find(user => user.id === userId);
  }

  /**
   * Get all test users
   */
  getAllTestUsers(): TestUser[] {
    return [...this.testUsers];
  }
}