import { BaseDriver } from './BaseDriver';
import type { User } from '../types';

/**
 * Authentication driver handling user login, logout, and session management
 */
export class AuthDriver extends BaseDriver {
  /**
   * Create email/password session
   */
  async login(email: string, password: string) {
    try {
      const session = await this.account.createEmailPasswordSession(email, password);
      return session;
    } catch (error) {
      throw this.handleError(error, 'login');
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User> {
    try {
      const user = await this.account.get();
      return user as User;
    } catch (error) {
      throw this.handleError(error, 'get current user');
    }
  }

  /**
   * Create user account
   */
  async createAccount(email: string, password: string, name: string) {
    try {
      const account = await this.account.create('unique()', email, password, name);
      return account;
    } catch (error) {
      throw this.handleError(error, 'create account');
    }
  }

  /**
   * Delete current session (logout)
   * Uses server-side API route to properly clear httpOnly session cookie
   */
  async logout() {
    try {
      // Call server-side logout API instead of client SDK
      // This is required because httpOnly cookies cannot be accessed from client-side JavaScript
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include', // Include httpOnly cookies
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Logout failed' }));
        throw new Error(errorData.error || 'Logout failed');
      }

      // Server-side logout succeeded
      console.log('[AuthDriver] Logout successful - session cleared');
    } catch (error) {
      // Log error but don't throw - we want to clear client state even if server logout fails
      console.error('[AuthDriver] Logout error:', error);
      throw this.handleError(error, 'logout');
    }
  }

  /**
   * Delete all user sessions
   */
  async logoutAll() {
    try {
      await this.account.deleteSessions();
    } catch (error) {
      throw this.handleError(error, 'logout all sessions');
    }
  }

  /**
   * Get all active sessions for current user
   */
  async getSessions() {
    try {
      const sessions = await this.account.listSessions();
      return sessions;
    } catch (error) {
      throw this.handleError(error, 'get sessions');
    }
  }

  /**
   * Update user name
   */
  async updateName(name: string) {
    try {
      const user = await this.account.updateName(name);
      return user as User;
    } catch (error) {
      throw this.handleError(error, 'update name');
    }
  }

  /**
   * Update user email
   */
  async updateEmail(email: string, password: string) {
    try {
      const user = await this.account.updateEmail(email, password);
      return user as User;
    } catch (error) {
      throw this.handleError(error, 'update email');
    }
  }

  /**
   * Update user password
   */
  async updatePassword(newPassword: string, oldPassword: string) {
    try {
      const user = await this.account.updatePassword(newPassword, oldPassword);
      return user as User;
    } catch (error) {
      throw this.handleError(error, 'update password');
    }
  }

  /**
   * Send password recovery email
   */
  async createRecovery(email: string, url: string) {
    try {
      const recovery = await this.account.createRecovery(email, url);
      return recovery;
    } catch (error) {
      throw this.handleError(error, 'create password recovery');
    }
  }

  /**
   * Complete password recovery
   */
  async updateRecovery(userId: string, secret: string, password: string, passwordAgain: string) {
    try {
      const recovery = await this.account.updateRecovery(userId, secret, password, passwordAgain);
      return recovery;
    } catch (error) {
      throw this.handleError(error, 'complete password recovery');
    }
  }

  /**
   * Send email verification
   */
  async createVerification(url: string) {
    try {
      const verification = await this.account.createVerification(url);
      return verification;
    } catch (error) {
      throw this.handleError(error, 'create email verification');
    }
  }

  /**
   * Complete email verification
   */
  async updateVerification(userId: string, secret: string) {
    try {
      const verification = await this.account.updateVerification(userId, secret);
      return verification;
    } catch (error) {
      throw this.handleError(error, 'complete email verification');
    }
  }
}