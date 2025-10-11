import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import type { Session, Evidence, LessonSnapshot } from '../types';
import { decompressJSON } from '../utils/compression';

/**
 * Session driver for session state management and progress tracking
 */
export class SessionDriver extends BaseDriver {
  /**
   * Get session state with current progress
   */
  async getSessionState(sessionId: string) {
    try {
      const session = await this.get<Session>('sessions', sessionId);
      const parsedSnapshot = decompressJSON<LessonSnapshot>(session.lessonSnapshot);

      // Validate decompression succeeded
      if (!parsedSnapshot) {
        throw new Error('Failed to decompress lesson snapshot');
      }
      
      // Get evidence count for progress calculation
      const evidence = await this.list<Evidence>('evidence', [
        Query.equal('sessionId', sessionId)
      ]);
      
      const currentCard = Math.min(evidence.length, parsedSnapshot.cards.length - 1);
      const totalCards = parsedSnapshot.cards.length;
      const completed = evidence.length >= totalCards;
      
      return {
        session,
        parsedSnapshot,
        progress: {
          currentCard,
          totalCards,
          completed,
          evidenceCount: evidence.length
        }
      };
    } catch (error) {
      throw this.handleError(error, 'get session state');
    }
  }
  
  /**
   * Get session analytics
   */
  async getSessionAnalytics(sessionId: string) {
    try {
      const session = await this.get<Session>('sessions', sessionId);
      const evidence = await this.list<Evidence>('evidence', [
        Query.equal('sessionId', sessionId)
      ]);
      
      const correctResponses = evidence.filter(e => e.correct);
      const accuracy = evidence.length > 0 ? Math.round((correctResponses.length / evidence.length) * 100) : 0;
      
      return {
        sessionId,
        totalResponses: evidence.length,
        correctResponses: correctResponses.length,
        accuracy,
        startedAt: session.$createdAt,
        endedAt: session.endedAt,
        duration: session.endedAt ? 
          new Date(session.endedAt).getTime() - new Date(session.$createdAt).getTime() : 
          null
      };
    } catch (error) {
      throw this.handleError(error, 'get session analytics');
    }
  }
  
  /**
   * Get current card for session
   */
  async getCurrentCard(sessionId: string) {
    try {
      const { parsedSnapshot, progress } = await this.getSessionState(sessionId);
      return {
        card: parsedSnapshot.cards[progress.currentCard],
        index: progress.currentCard,
        isLast: progress.currentCard >= parsedSnapshot.cards.length - 1
      };
    } catch (error) {
      throw this.handleError(error, 'get current card');
    }
  }
  
  /**
   * Check if session is ready for next card
   */
  async canProgressToNext(sessionId: string): Promise<boolean> {
    try {
      const { progress } = await this.getSessionState(sessionId);
      return progress.evidenceCount > progress.currentCard;
    } catch (error) {
      throw this.handleError(error, 'check progress');
    }
  }
  
  /**
   * Get session summary for dashboard display
   */
  async getSessionSummary(sessionId: string) {
    try {
      const [sessionState, analytics] = await Promise.all([
        this.getSessionState(sessionId),
        this.getSessionAnalytics(sessionId)
      ]);
      
      return {
        id: sessionId,
        title: sessionState.parsedSnapshot.title,
        progress: sessionState.progress,
        analytics,
        status: sessionState.session.stage,
        isCompleted: sessionState.progress.completed || sessionState.session.endedAt !== null
      };
    } catch (error) {
      throw this.handleError(error, 'get session summary');
    }
  }

  /**
   * Update session with thread ID for conversation continuity
   */
  async updateSessionThreadId(sessionId: string, threadId: string) {
    try {
      await this.update('sessions', sessionId, {
        threadId,
        lastMessageAt: new Date().toISOString()
      });
      console.log(`SessionDriver - Updated session ${sessionId} with thread ID: ${threadId}`);
    } catch (error) {
      throw this.handleError(error, 'update session thread ID');
    }
  }

  /**
   * Update last message timestamp for session
   */
  async updateLastMessageTime(sessionId: string) {
    try {
      await this.update('sessions', sessionId, {
        lastMessageAt: new Date().toISOString()
      });
    } catch (error) {
      throw this.handleError(error, 'update last message time');
    }
  }

  /**
   * Get session with thread information
   */
  async getSessionWithThread(sessionId: string) {
    try {
      const session = await this.get<Session>('sessions', sessionId);
      return {
        session,
        threadId: session.threadId || undefined,
        hasExistingConversation: !!session.threadId,
        lastMessageAt: session.lastMessageAt || undefined
      };
    } catch (error) {
      throw this.handleError(error, 'get session with thread');
    }
  }

  /**
   * Update session with context chat thread ID for separate context conversations
   */
  async updateContextChatThreadId(sessionId: string, contextChatThreadId: string) {
    try {
      await this.update('sessions', sessionId, {
        contextChatThreadId,
        lastMessageAt: new Date().toISOString()
      });
      console.log(`SessionDriver - Updated session ${sessionId} with context chat thread ID: ${contextChatThreadId}`);
    } catch (error) {
      throw this.handleError(error, 'update context chat thread ID');
    }
  }

  /**
   * Get session with both main and context chat thread information
   */
  async getSessionWithContextChat(sessionId: string) {
    try {
      const session = await this.get<Session>('sessions', sessionId);
      return {
        session,
        threadId: session.threadId || undefined,
        contextChatThreadId: session.contextChatThreadId || undefined,
        hasExistingConversation: !!session.threadId,
        hasExistingContextChat: !!session.contextChatThreadId,
        lastMessageAt: session.lastMessageAt || undefined
      };
    } catch (error) {
      throw this.handleError(error, 'get session with context chat');
    }
  }

  /**
   * Update session data
   */
  async updateSession(sessionId: string, data: Partial<Session>): Promise<Session> {
    try {
      return await this.update<Session>('sessions', sessionId, data);
    } catch (error) {
      throw this.handleError(error, 'update session');
    }
  }
}