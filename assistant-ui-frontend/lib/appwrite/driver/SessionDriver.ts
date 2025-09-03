import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import type { Session, Evidence, LessonSnapshot } from '../types';

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
      const parsedSnapshot = JSON.parse(session.lessonSnapshot) as LessonSnapshot;
      
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
}