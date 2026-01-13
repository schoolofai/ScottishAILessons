import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import { decompressJSON } from '../utils/compression';
import { logger, createLogger } from '@/lib/logger';

const log = createLogger('PastPaperDriver');

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Paper document from us_papers collection
 */
export interface PaperDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  subject: string;
  level: string;
  level_code: string;
  paper_code: string;
  year: number;
  paper_number: number;
  topic_tags: string;  // JSON array string
  total_marks: number;
  duration_minutes: number;
  calculator_allowed: boolean;
  data: string;  // Compressed JSON with questions
  last_modified: string;
}

/**
 * Parsed paper data from the `data` field
 */
export interface PaperData {
  subject: string;
  level: string;
  level_code: string;
  paper_code: string;
  year: number;
  paper_number: number;
  topic_tags: string[];
  total_marks: number;
  duration_minutes: number;
  calculator_allowed: boolean;
  questions: PaperQuestion[];
  general_principles: GeneralPrinciple[];
  formulae: Formula[];
}

/**
 * Question structure from paper data
 */
export interface PaperQuestion {
  number: string;
  text: string;
  text_latex: string;
  marks: number | null;
  has_parts: boolean;
  parts: QuestionPart[];
  topic_tags: string[];
  diagrams: DiagramRef[];
  solution?: SolutionData;
}

export interface QuestionPart {
  part: string;
  subpart: string | null;
  text: string;
  text_latex: string;
  marks: number;
  topic_tags: string[];
  solution?: SolutionData;
}

export interface SolutionData {
  max_marks: number;
  generic_scheme: MarkingBullet[];
  illustrative_scheme: IllustrativeBullet[];
  notes: string[];
}

export interface MarkingBullet {
  bullet: number;
  process: string;
}

export interface IllustrativeBullet {
  bullet: number;
  answer: string;
  answer_latex?: string;
  condition?: string;
  alternative?: string;
  alternative_latex?: string;
}

export interface DiagramRef {
  id: string;
  type: string;
  description: string;
}

export interface GeneralPrinciple {
  principle_id: string;
  principle: string;
  description: string;
}

export interface Formula {
  name: string;
  latex: string;
  description: string;
}

/**
 * Walkthrough document from us_walkthroughs collection
 */
export interface WalkthroughDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  paper_id: string;
  question_number: string;
  paper_code: string;
  year: number;
  subject: string;
  level: string;
  marks: number;
  walkthrough_content: string;  // Compressed JSON
  common_errors: string;  // JSON array
  status: 'draft' | 'published' | 'archived';
  model_version: string;
  generation_metadata: string | null;
  catalog_version: string | null;
  last_modified: string;
}

/**
 * Decompressed walkthrough content
 */
export interface WalkthroughContent {
  question_stem: string;
  question_stem_latex: string;
  topic_tags: string[];
  total_marks: number;
  steps: WalkthroughStep[];
  common_errors: CommonError[];
  examiner_summary: string;
  diagram_refs: string[];
}

export interface WalkthroughStep {
  bullet: number;
  label: string;
  process: string;
  working: string;
  working_latex: string;
  marks_earned: number;
  examiner_notes?: string;
}

export interface CommonError {
  error_type: 'notation' | 'calculation' | 'concept' | 'omission';
  description: string;
  why_marks_lost: string;
  prevention_tip: string;
}

/**
 * Navigation structure for browsing
 */
export interface PaperBrowseItem {
  paperId: string;
  subject: string;
  level: string;
  year: number;
  paperCode: string;
  totalMarks: number;
  questionCount: number;
  calculatorAllowed: boolean;
  hasWalkthroughs: boolean;
}

export interface SubjectLevelYear {
  subject: string;
  level: string;
  years: number[];
}

// =============================================================================
// PastPaperDriver Class
// =============================================================================

/**
 * PastPaperDriver - Handles past paper and walkthrough operations
 *
 * Uses sqa_education database (not default):
 * - us_papers: SQA past paper data with questions and marking schemes
 * - us_walkthroughs: Generated examiner-aligned walkthroughs
 */
export class PastPaperDriver extends BaseDriver {
  private static readonly DB_SQA = 'sqa_education';
  private static readonly COLLECTION_PAPERS = 'us_papers';
  private static readonly COLLECTION_WALKTHROUGHS = 'us_walkthroughs';

  // Override to use sqa_education database
  private async listFromSqa<T>(collectionId: string, queries: string[] = []): Promise<T[]> {
    try {
      const response = await this.databases.listDocuments(
        PastPaperDriver.DB_SQA,
        collectionId,
        queries
      );
      return response.documents as T[];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list from ${collectionId}: ${message}`);
    }
  }

  private async getFromSqa<T>(collectionId: string, documentId: string): Promise<T> {
    try {
      const document = await this.databases.getDocument(
        PastPaperDriver.DB_SQA,
        collectionId,
        documentId
      );
      return document as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get ${documentId} from ${collectionId}: ${message}`);
    }
  }

  // ==========================================================================
  // Paper Browsing Methods
  // ==========================================================================

  /**
   * Get available subjects and levels for navigation
   */
  async getAvailableSubjectsAndLevels(): Promise<SubjectLevelYear[]> {
    log.info('Fetching available subjects and levels');

    try {
      const papers = await this.listFromSqa<PaperDocument>(
        PastPaperDriver.COLLECTION_PAPERS,
        [Query.orderAsc('subject'), Query.orderAsc('level')]
      );

      // Group by subject-level and collect years
      const grouped = new Map<string, SubjectLevelYear>();

      for (const paper of papers) {
        const key = `${paper.subject}|${paper.level}`;

        if (!grouped.has(key)) {
          grouped.set(key, {
            subject: paper.subject,
            level: paper.level,
            years: []
          });
        }

        const entry = grouped.get(key)!;
        if (!entry.years.includes(paper.year)) {
          entry.years.push(paper.year);
        }
      }

      // Sort years descending
      const result = Array.from(grouped.values());
      for (const entry of result) {
        entry.years.sort((a, b) => b - a);
      }

      log.info(`Found ${result.length} subject-level combinations`);
      return result;
    } catch (error) {
      log.error('Failed to get subjects and levels', { error });
      throw this.handleError(error, 'get subjects and levels');
    }
  }

  /**
   * Get papers for a specific subject and level
   */
  async getPapers(filter: {
    subject?: string;
    level?: string;
    year?: number;
  }): Promise<PaperBrowseItem[]> {
    log.info('Fetching papers', filter);

    try {
      const queries: string[] = [];

      if (filter.subject) {
        queries.push(Query.equal('subject', filter.subject));
      }
      if (filter.level) {
        queries.push(Query.equal('level', filter.level));
      }
      if (filter.year) {
        queries.push(Query.equal('year', filter.year));
      }

      queries.push(Query.orderDesc('year'));

      const papers = await this.listFromSqa<PaperDocument>(
        PastPaperDriver.COLLECTION_PAPERS,
        queries
      );

      // Get paper IDs to check for walkthroughs
      const paperIds = papers.map(p => p.$id);
      const papersWithWalkthroughs = await this.getPaperIdsWithWalkthroughs(paperIds);

      // Build response items
      const items: PaperBrowseItem[] = [];

      for (const paper of papers) {
        // Parse data to get question count
        let questionCount = 0;
        try {
          const paperData = JSON.parse(paper.data) as PaperData;
          questionCount = this.countQuestionsWithSolutions(paperData.questions);
        } catch {
          log.warn(`Failed to parse paper data for ${paper.$id}`);
        }

        items.push({
          paperId: paper.$id,
          subject: paper.subject,
          level: paper.level,
          year: paper.year,
          paperCode: paper.paper_code,
          totalMarks: paper.total_marks,
          questionCount,
          calculatorAllowed: paper.calculator_allowed,
          hasWalkthroughs: papersWithWalkthroughs.has(paper.$id)
        });
      }

      log.info(`Found ${items.length} papers, ${papersWithWalkthroughs.size} with walkthroughs`);
      return items;
    } catch (error) {
      log.error('Failed to get papers', { error, filter });
      throw this.handleError(error, 'get papers');
    }
  }

  /**
   * Get a specific paper with parsed data
   */
  async getPaper(paperId: string): Promise<{ document: PaperDocument; data: PaperData }> {
    if (!paperId || paperId.trim().length === 0) {
      throw new Error('Paper ID is required');
    }

    log.info(`Fetching paper: ${paperId}`);

    try {
      const document = await this.getFromSqa<PaperDocument>(
        PastPaperDriver.COLLECTION_PAPERS,
        paperId
      );

      // Parse the data field
      const data = JSON.parse(document.data) as PaperData;

      log.info(`Retrieved paper: ${data.subject} ${data.level} ${data.year}`);
      return { document, data };
    } catch (error) {
      log.error(`Failed to get paper ${paperId}`, { error });
      throw this.handleError(error, `get paper ${paperId}`);
    }
  }

  /**
   * Get questions list for a paper (for navigation)
   */
  async getQuestionsList(paperId: string): Promise<Array<{
    number: string;
    marks: number;
    topicTags: string[];
    hasSolution: boolean;
    hasWalkthrough: boolean;
  }>> {
    const { data } = await this.getPaper(paperId);

    // Get question numbers with published walkthroughs
    const walkthroughQuestions = await this.getWalkthroughQuestionNumbers(paperId);

    const questions: Array<{
      number: string;
      marks: number;
      topicTags: string[];
      hasSolution: boolean;
      hasWalkthrough: boolean;
    }> = [];

    for (const q of data.questions) {
      if (q.has_parts) {
        // Add each part as a separate entry
        for (const part of q.parts) {
          const partNumber = part.subpart
            ? `${q.number}${part.part}(${part.subpart})`
            : `${q.number}${part.part}`;

          questions.push({
            number: partNumber,
            marks: part.marks,
            topicTags: part.topic_tags || q.topic_tags,
            hasSolution: !!part.solution,
            hasWalkthrough: walkthroughQuestions.has(partNumber)
          });
        }
      } else {
        questions.push({
          number: q.number,
          marks: q.marks || 0,
          topicTags: q.topic_tags,
          hasSolution: !!q.solution,
          hasWalkthrough: walkthroughQuestions.has(String(q.number))
        });
      }
    }

    return questions;
  }

  // ==========================================================================
  // Walkthrough Methods
  // ==========================================================================

  /**
   * Get walkthrough for a specific question
   */
  async getWalkthrough(
    paperId: string,
    questionNumber: string
  ): Promise<{ document: WalkthroughDocument; content: WalkthroughContent } | null> {
    log.info(`Fetching walkthrough: ${paperId} Q${questionNumber}`);

    try {
      const documents = await this.listFromSqa<WalkthroughDocument>(
        PastPaperDriver.COLLECTION_WALKTHROUGHS,
        [
          Query.equal('paper_id', paperId),
          Query.equal('question_number', questionNumber),
          Query.equal('status', 'published')
        ]
      );

      if (documents.length === 0) {
        log.info(`No walkthrough found for ${paperId} Q${questionNumber}`);
        return null;
      }

      const document = documents[0];

      // Decompress walkthrough content
      const content = decompressJSON<WalkthroughContent>(document.walkthrough_content);

      if (!content) {
        throw new Error('Failed to decompress walkthrough content');
      }

      log.info(`Retrieved walkthrough with ${content.steps.length} steps`);
      return { document, content };
    } catch (error) {
      log.error(`Failed to get walkthrough for ${paperId} Q${questionNumber}`, { error });
      throw this.handleError(error, `get walkthrough ${paperId} Q${questionNumber}`);
    }
  }

  /**
   * Get all walkthroughs for a paper
   */
  async getWalkthroughsForPaper(paperId: string): Promise<WalkthroughDocument[]> {
    log.info(`Fetching walkthroughs for paper: ${paperId}`);

    try {
      const documents = await this.listFromSqa<WalkthroughDocument>(
        PastPaperDriver.COLLECTION_WALKTHROUGHS,
        [
          Query.equal('paper_id', paperId),
          Query.equal('status', 'published'),
          Query.orderAsc('question_number')
        ]
      );

      log.info(`Found ${documents.length} walkthroughs for paper ${paperId}`);
      return documents;
    } catch (error) {
      log.error(`Failed to get walkthroughs for paper ${paperId}`, { error });
      throw this.handleError(error, `get walkthroughs for paper ${paperId}`);
    }
  }

  /**
   * Check if a course has past papers available
   * Used for dashboard integration
   */
  async hasPastPapersForSubjectLevel(subject: string, level: string): Promise<boolean> {
    if (!subject || !level) {
      return false;
    }

    try {
      const papers = await this.listFromSqa<PaperDocument>(
        PastPaperDriver.COLLECTION_PAPERS,
        [
          Query.equal('subject', subject),
          Query.equal('level', level),
          Query.limit(1)
        ]
      );

      return papers.length > 0;
    } catch (error) {
      log.error('Error checking past papers', { error, subject, level });
      return false;
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Get a Set of question numbers that have published walkthroughs for a paper
   * Used for efficient hasWalkthrough checks in question lists
   */
  async getWalkthroughQuestionNumbers(paperId: string): Promise<Set<string>> {
    try {
      const documents = await this.listFromSqa<WalkthroughDocument>(
        PastPaperDriver.COLLECTION_WALKTHROUGHS,
        [
          Query.equal('paper_id', paperId),
          Query.equal('status', 'published'),
          Query.select(['question_number'])
        ]
      );

      return new Set(documents.map(d => d.question_number));
    } catch (error) {
      log.error(`Failed to get walkthrough question numbers for ${paperId}`, { error });
      return new Set();
    }
  }

  /**
   * Get a Set of paper IDs that have at least one published walkthrough
   * Used for efficient hasWalkthroughs checks in paper lists
   */
  async getPaperIdsWithWalkthroughs(paperIds: string[]): Promise<Set<string>> {
    if (paperIds.length === 0) {
      return new Set();
    }

    try {
      const documents = await this.listFromSqa<WalkthroughDocument>(
        PastPaperDriver.COLLECTION_WALKTHROUGHS,
        [
          Query.equal('paper_id', paperIds),
          Query.equal('status', 'published'),
          Query.select(['paper_id']),
          Query.limit(500)
        ]
      );

      return new Set(documents.map(d => d.paper_id));
    } catch (error) {
      log.error('Failed to get paper IDs with walkthroughs', { error });
      return new Set();
    }
  }

  /**
   * Count questions that have solutions (walkthroughs can be generated)
   */
  private countQuestionsWithSolutions(questions: PaperQuestion[]): number {
    let count = 0;

    for (const q of questions) {
      if (q.has_parts) {
        for (const part of q.parts) {
          if (part.solution) {
            count++;
          }
        }
      } else if (q.solution) {
        count++;
      }
    }

    return count;
  }

  /**
   * Handle errors consistently
   */
  protected handleError(error: unknown, context: string): Error {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Error in ${context}: ${message}`);
    return new Error(`PastPaperDriver: ${context} failed - ${message}`);
  }
}
