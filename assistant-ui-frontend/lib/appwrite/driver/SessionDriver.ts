import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import type { Session, Evidence, LessonSnapshot } from '../types';
import { decompressJSON } from '../utils/compression';
import * as pako from 'pako';

/**
 * Conversation history type for replay
 */
export type ConversationHistory = {
  version: string;
  threadId: string;
  sessionId: string;
  capturedAt: string;
  messages: Array<{
    id: string;
    type: string;
    content: string;
    tool_calls?: Array<{
      id: string;
      name: string;
      args: any;
    }>;
  }>;
};

/**
 * Decompress conversation history from storage format
 * Reverses gzip compression + base64 encoding
 */
function decompressConversationHistory(compressedBase64: string): ConversationHistory {
  try {
    // Decode base64 to binary
    const binaryString = atob(compressedBase64);
    const compressed = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      compressed[i] = binaryString.charCodeAt(i);
    }

    // Decompress with pako
    const decompressed = pako.ungzip(compressed, { to: 'string' });

    // Parse JSON
    const history = JSON.parse(decompressed);

    console.log(`🗜️ Decompression successful: ${history.messages?.length || 0} messages recovered`);

    return history;
  } catch (error) {
    console.error('❌ Failed to decompress conversation history:', error);
    throw new Error('Decompression failed');
  }
}

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

      // 🔍 DEBUG: Log raw snapshot before decompression
      console.log('🔍 [SessionDriver DEBUG] Raw lessonSnapshot before decompression:',
        typeof session.lessonSnapshot,
        session.lessonSnapshot.substring(0, 100) + '...');

      const parsedSnapshot = decompressJSON<LessonSnapshot>(session.lessonSnapshot);

      // Validate decompression succeeded
      if (!parsedSnapshot) {
        throw new Error('Failed to decompress lesson snapshot');
      }

      // 🔍 DEBUG: Log outcomeRefs after decompression
      console.log('🔍 [SessionDriver DEBUG] parsedSnapshot.outcomeRefs after decompression:',
        Array.isArray(parsedSnapshot.outcomeRefs) ? parsedSnapshot.outcomeRefs : typeof parsedSnapshot.outcomeRefs,
        JSON.stringify(parsedSnapshot.outcomeRefs)
      );
      
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

  /**
   * Update session with compressed conversation history
   * This should be called before completing the session
   */
  async updateConversationHistory(sessionId: string, compressedHistory: string): Promise<Session> {
    try {
      console.log(`SessionDriver - Updating conversation history for session ${sessionId}`);
      console.log(`SessionDriver - Compressed history size: ${(compressedHistory.length / 1024).toFixed(2)} KB`);

      return await this.update<Session>('sessions', sessionId, {
        conversationHistory: compressedHistory
      });
    } catch (error) {
      throw this.handleError(error, 'update conversation history');
    }
  }

  /**
   * Get session document by ID
   * Public wrapper around protected get() method
   */
  async getSession(sessionId: string): Promise<Session> {
    try {
      return await this.get<Session>('sessions', sessionId);
    } catch (error) {
      throw this.handleError(error, 'get session');
    }
  }

  /**
   * Retrieve and decompress conversation history for session replay
   * Returns null if no history is stored
   */
  async getConversationHistory(sessionId: string): Promise<ConversationHistory | null> {
    try {
      const session = await this.get<Session>('sessions', sessionId);

      if (!session.conversationHistory) {
        console.log(`SessionDriver - No conversation history stored for session ${sessionId}`);
        return null;
      }

      console.log(`SessionDriver - Decompressing conversation history for session ${sessionId}`);
      const history = decompressConversationHistory(session.conversationHistory);

      return history;
    } catch (error) {
      throw this.handleError(error, 'get conversation history');
    }
  }

  /**
   * Get both session and conversation history for replay
   * Returns session and conversation history together
   */
  async getSessionWithHistory(sessionId: string): Promise<{ session: Session; history: ConversationHistory | null }> {
    try {
      const session = await this.get<Session>('sessions', sessionId);

      let history: ConversationHistory | null = null;
      if (session.conversationHistory) {
        console.log(`SessionDriver - Decompressing conversation history for session ${sessionId}`);
        history = decompressConversationHistory(session.conversationHistory);
      } else {
        console.log(`SessionDriver - No conversation history stored for session ${sessionId}`);
      }

      return { session, history };
    } catch (error) {
      throw this.handleError(error, 'get session with history');
    }
  }

  /**
   * Mark session as completed
   * Should be called when student finishes all lesson cards
   */
  async completeSession(sessionId: string, score?: number): Promise<Session> {
    try {
      const completionData: Partial<Session> = {
        status: 'completed',
        endedAt: new Date().toISOString()
      };

      if (score !== undefined) {
        completionData.score = score;
      }

      console.log(`SessionDriver - Marking session ${sessionId} as completed with score: ${score}`);
      return await this.update<Session>('sessions', sessionId, completionData);
    } catch (error) {
      throw this.handleError(error, 'complete session');
    }
  }

  /**
   * Mark session as expired (thread no longer available after 7-day limit)
   *
   * This is called when a user tries to resume a lesson but the LangGraph
   * thread has expired. The session is marked as 'failed' with an endedAt timestamp.
   * Note: 'stage' has an enum constraint so we cannot set it to 'expired'.
   *
   * @param sessionId - The session document ID
   * @returns Updated session document
   */
  async markSessionExpired(sessionId: string): Promise<Session> {
    try {
      console.log(`SessionDriver - Marking session ${sessionId} as expired (thread unavailable)`);

      // Note: 'stage' has enum constraint (design, deliver, mark, progress, done)
      // We use status: 'failed' to indicate expiry, keeping stage unchanged
      // The threadId becoming invalid is the actual indicator of expiry
      return await this.update<Session>('sessions', sessionId, {
        status: 'failed',
        endedAt: new Date().toISOString()
      });
    } catch (error) {
      throw this.handleError(error, 'mark session expired');
    }
  }
}