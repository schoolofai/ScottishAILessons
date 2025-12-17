import { Query, Storage, Client } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import type { ParsedBlockContent, WorkedExample } from '@/types/practice-wizard-contracts';

// Storage bucket ID for practice content files (hints, solutions)
const PRACTICE_CONTENT_BUCKET_ID = 'practice_content';

/**
 * TypeScript interface for practice_questions collection document
 * Pre-generated questions stored by the offline author pipeline
 */
/**
 * Full question data stored in Appwrite Storage file
 * Referenced by questionDataFileId in the collection document
 */
export interface QuestionDataFile {
  stem: string;
  options?: string[];
  correct_answer: string;
  acceptable_answers?: string[];
  solution?: string;
  hints?: string[];
}

export interface PracticeQuestion {
  $id: string;
  lessonTemplateId: string;
  blockId: string;
  blockTitle: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'multiple_choice' | 'numeric' | 'short_answer' | 'structured_response';
  // Preview fields stored in document (for listing/filtering)
  stemPreview: string;
  optionsPreview?: string;
  // Full data stored in file (referenced by ID)
  questionDataFileId: string;
  // Legacy fields (may not be populated - use questionDataFileId instead)
  stem?: string;
  options?: string | null;
  correctAnswer?: string;
  acceptableAnswers?: string | null;
  solutionFileId?: string;
  hintsFileId?: string;
  diagramRequired: boolean;
  diagramTool: 'NONE' | 'DESMOS' | 'MATPLOTLIB' | 'JSXGRAPH' | 'PLOTLY' | 'IMAGE_GENERATION';
  diagramFileId: string | null;
  diagramJson: string | null;
  outcomeRefs: string | null;
  contentHash: string;
  generatorVersion: string;
  executionId: string;
  generatedAt: string;
  status: 'draft' | 'published' | 'archived';
}

/**
 * Parsed practice question with JSON fields deserialized.
 * NOTE: Includes both camelCase (questionType) and snake_case (question_type)
 * for compatibility with different parts of the system.
 */
export interface ParsedPracticeQuestion {
  question_id: string;
  lessonTemplateId: string;
  blockId: string;
  blockTitle: string;
  block_id: string;        // Alias for contract compatibility
  block_title: string;     // Alias for contract compatibility
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'mcq' | 'numeric' | 'structured_response';  // Contract types
  question_type: 'mcq' | 'numeric' | 'structured_response'; // Alias for contract (QuestionStep)
  stem: string;
  stemPreview: string;
  options: string[] | null;
  correctAnswer: string;
  correct_answer: string;
  acceptableAnswers: string[] | null;
  solutionFileId: string;
  hintsFileId: string;
  hints: string[];
  // Diagram storage fields (from Appwrite document)
  diagramRequired: boolean;
  diagramTool: string;
  diagramFileId: string | null;
  diagramJson: string | null;
  // Diagram display fields (loaded from storage - matches QuestionStep contract)
  diagram_base64?: string;        // Base64-encoded image for display
  diagram_title?: string;         // Title for the diagram
  diagram_description?: string;   // Alt text / description
  diagram_type?: string;          // Type of diagram (e.g., "geometry", "graph")
  outcomeRefs: string[] | null;
  outcome_refs: string[] | null; // Alias for contract compatibility
  status: string;
}

/**
 * Question availability info for gray-out logic
 */
export interface QuestionAvailability {
  lessonTemplateId: string;
  hasQuestions: boolean;
  totalCount: number;
  byDifficulty: {
    easy: number;
    medium: number;
    hard: number;
  };
  byBlock: Array<{
    blockId: string;
    blockTitle: string;
    count: number;
  }>;
}

/**
 * Result from getRandomQuestion with pool metadata
 * Used by hook to know when to clear exclusion tracking
 */
export interface RandomQuestionResult {
  question: ParsedPracticeQuestion;
  poolReset: boolean;     // True if all questions were excluded and pool was reset
  poolSize: number;       // Total questions available for this block/difficulty
}

/**
 * Storage file content structure for block data.
 * This matches the ConceptBlockContent schema from the Python upserter.
 */
export interface BlockDataFileContent {
  explanation: string;
  worked_example: WorkedExample | null;
  key_formulas: string[];
  common_misconceptions: string[];
}

/**
 * TypeScript interface for practice_blocks collection document.
 * Matches the actual Appwrite schema - uses SINGLE blockDataFileId for all content.
 */
export interface PracticeBlock {
  $id: string;
  lessonTemplateId: string;
  blockId: string;
  blockIndex: number;
  title: string;
  explanationPreview: string;      // Short preview for listing (stored in doc)
  blockDataFileId: string;          // SINGLE file ID containing all block content
  outcomeRefs: string;              // JSON string of outcome references
  contentHash: string;
  generatorVersion: string;
  executionId: string;
  generatedAt: string;
}

const QUESTIONS_COLLECTION_ID = 'practice_questions';
const BLOCKS_COLLECTION_ID = 'practice_blocks';

/**
 * Normalize question type from stored format to frontend contract format.
 *
 * Storage/Backend format → Frontend contract format:
 * - multiple_choice → mcq
 * - short_answer → structured_response
 * - numeric → numeric
 * - structured_response → structured_response
 *
 * Contract: "mcq" | "numeric" | "structured_response"
 */
function normalizeQuestionType(storedType: string): 'mcq' | 'numeric' | 'structured_response' {
  const typeMap: Record<string, 'mcq' | 'numeric' | 'structured_response'> = {
    'multiple_choice': 'mcq',      // Storage format → Contract format
    'mcq': 'mcq',                  // Already contract format
    'numeric': 'numeric',          // Same in both
    'short_answer': 'structured_response',
    'structured_response': 'structured_response',
  };
  return typeMap[storedType] || 'structured_response';
}

/**
 * PracticeQuestionDriver - Frontend driver for fetching pre-generated practice questions
 *
 * This driver implements the frontend-driven architecture where:
 * - Frontend fetches pre-generated questions from Appwrite
 * - Frontend passes questions to backend via session_context
 * - Backend remains Appwrite-agnostic (marking only)
 *
 * If no questions are available, methods throw errors (fast-fail pattern)
 *
 * Gap P1 Implementation: Storage file loading for hints/solution
 */
export class PracticeQuestionDriver extends BaseDriver {
  private storage: Storage;

  constructor(sessionToken?: string) {
    super(sessionToken);
    // Initialize Storage with same client as BaseDriver
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
    if (sessionToken) {
      client.setSession(sessionToken);
    }
    this.storage = new Storage(client);
  }

  /**
   * Load file content from Appwrite Storage bucket.
   * Returns parsed JSON if file is JSON, raw text otherwise.
   *
   * @param fileId - Storage file ID
   * @returns Parsed content (JSON array/object or string)
   */
  private async loadStorageFile<T = unknown>(fileId: string): Promise<T | null> {
    if (!fileId) {
      return null;
    }

    try {
      console.log('[PracticeQuestionDriver] Loading storage file:', fileId);

      // Get file download URL and fetch content
      const fileUrl = this.storage.getFileDownload(PRACTICE_CONTENT_BUCKET_ID, fileId);

      const response = await fetch(fileUrl.toString());
      if (!response.ok) {
        console.warn('[PracticeQuestionDriver] Failed to fetch file:', response.status);
        return null;
      }

      const text = await response.text();

      // Try to parse as JSON
      try {
        return JSON.parse(text) as T;
      } catch {
        // Not JSON, return as string (cast through unknown)
        return text as unknown as T;
      }
    } catch (error) {
      console.warn('[PracticeQuestionDriver] Error loading file:', fileId, error);
      return null;
    }
  }

  /**
   * Load an image from Appwrite Storage and convert to base64.
   * Used for loading diagram images stored with practice questions.
   *
   * @param fileId - Storage file ID of the image
   * @returns Base64-encoded image string (without data URI prefix), or null if loading fails
   */
  async loadImageAsBase64(fileId: string): Promise<string | null> {
    if (!fileId) {
      return null;
    }

    try {
      console.log('[PracticeQuestionDriver] Loading image as base64:', fileId);

      // Get file download URL and fetch as binary
      const fileUrl = this.storage.getFileDownload(PRACTICE_CONTENT_BUCKET_ID, fileId);

      const response = await fetch(fileUrl.toString());
      if (!response.ok) {
        console.warn('[PracticeQuestionDriver] Failed to fetch image:', response.status);
        return null;
      }

      // Get the binary data as ArrayBuffer
      const arrayBuffer = await response.arrayBuffer();

      // Convert to base64 string
      // In browser: use btoa with Uint8Array
      // In Node.js: use Buffer
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);

      console.log('[PracticeQuestionDriver] Image loaded, base64 length:', base64.length);
      return base64;
    } catch (error) {
      console.warn('[PracticeQuestionDriver] Error loading image:', fileId, error);
      return null;
    }
  }

  /**
   * Load full question data from storage file (stem, options, correct_answer, etc.).
   * CRITICAL: The collection document only stores preview/metadata fields.
   * Full question data is stored in the questionDataFileId file.
   *
   * Also loads diagram image from diagramFileId if present, converting to base64
   * for display in QuestionStep component.
   *
   * @param doc - Raw document from Appwrite
   * @returns Parsed question with full data from file
   * @throws Error if file cannot be loaded (fast-fail)
   */
  private async loadQuestionDataFile(doc: PracticeQuestion): Promise<ParsedPracticeQuestion> {
    const fileId = doc.questionDataFileId;

    if (!fileId) {
      // Fall back to document fields (legacy format)
      console.warn('[PracticeQuestionDriver] No questionDataFileId, using legacy document fields');
      return this.parseQuestionFromDocument(doc);
    }

    console.log('[PracticeQuestionDriver] Loading question data file:', fileId);

    const questionData = await this.loadStorageFile<QuestionDataFile>(fileId);

    if (!questionData) {
      throw new Error(
        `Failed to load question data file: ${fileId}. ` +
        `Question ${doc.$id} cannot be used without full data.`
      );
    }

    console.log('[PracticeQuestionDriver] Loaded question data:', {
      hasStem: !!questionData.stem,
      hasOptions: !!questionData.options,
      hasCorrectAnswer: !!questionData.correct_answer,
      hasDiagramFileId: !!doc.diagramFileId,
    });

    // Load diagram image if diagramFileId is present
    let diagramBase64: string | undefined;
    if (doc.diagramFileId) {
      console.log('[PracticeQuestionDriver] Loading diagram image:', doc.diagramFileId);
      const base64 = await this.loadImageAsBase64(doc.diagramFileId);
      if (base64) {
        diagramBase64 = base64;
        console.log('[PracticeQuestionDriver] Diagram loaded successfully');
      } else {
        console.warn('[PracticeQuestionDriver] Failed to load diagram image, question will display without diagram');
      }
    }

    // Merge file data with document metadata
    const normalizedType = normalizeQuestionType(doc.questionType);
    const parsedOutcomeRefs = doc.outcomeRefs ? JSON.parse(doc.outcomeRefs) : null;

    // Normalize options: extract text from option objects if needed
    // Storage format may be: [{label: "A", text: "17m", is_correct: false}, ...]
    // Frontend contract expects: ["17m", "34m", ...]
    let normalizedOptions: string[] | null = null;
    if (questionData.options && Array.isArray(questionData.options)) {
      normalizedOptions = questionData.options.map((opt: unknown) => {
        if (typeof opt === 'string') {
          return opt;
        }
        if (typeof opt === 'object' && opt !== null && 'text' in opt) {
          return String((opt as { text: unknown }).text);
        }
        // Fallback: stringify the object
        console.warn('[PracticeQuestionDriver] Unexpected option format:', opt);
        return String(opt);
      });
      console.log('[PracticeQuestionDriver] Normalized options:', normalizedOptions);
    }

    // Generate diagram metadata from diagramTool if diagram is present
    const diagramTitle = diagramBase64 ? 'Question Diagram' : undefined;
    const diagramDescription = diagramBase64 ? `Diagram for ${doc.blockTitle}` : undefined;
    const diagramType = diagramBase64 ? this.getDiagramTypeFromTool(doc.diagramTool) : undefined;

    return {
      question_id: doc.$id,
      lessonTemplateId: doc.lessonTemplateId,
      blockId: doc.blockId,
      blockTitle: doc.blockTitle,
      block_id: doc.blockId,           // Alias for contract
      block_title: doc.blockTitle,     // Alias for contract
      difficulty: doc.difficulty,
      questionType: normalizedType,
      question_type: normalizedType,   // Alias for contract (QuestionStep)
      // Full data from file
      stem: questionData.stem,
      stemPreview: doc.stemPreview,
      options: normalizedOptions,
      correctAnswer: questionData.correct_answer,
      correct_answer: questionData.correct_answer,
      acceptableAnswers: questionData.acceptable_answers || null,
      // Hints from file (may also be in separate hintsFileId)
      hints: questionData.hints || [],
      hintsFileId: doc.hintsFileId || '',
      solutionFileId: doc.solutionFileId || '',
      // Diagram storage fields from document
      diagramRequired: doc.diagramRequired,
      diagramTool: doc.diagramTool,
      diagramFileId: doc.diagramFileId,
      diagramJson: doc.diagramJson,
      // Diagram display fields (loaded from storage)
      diagram_base64: diagramBase64,
      diagram_title: diagramTitle,
      diagram_description: diagramDescription,
      diagram_type: diagramType,
      outcomeRefs: parsedOutcomeRefs,
      outcome_refs: parsedOutcomeRefs, // Alias for contract
      status: doc.status,
    };
  }

  /**
   * Map diagramTool enum to a user-friendly diagram type string.
   * Used for diagram_type field in parsed questions.
   */
  private getDiagramTypeFromTool(tool: string): string {
    const toolTypeMap: Record<string, string> = {
      'DESMOS': 'graph',
      'MATPLOTLIB': 'chart',
      'JSXGRAPH': 'geometry',
      'PLOTLY': 'chart',
      'IMAGE_GENERATION': 'diagram',
      'NONE': 'diagram',
    };
    return toolTypeMap[tool] || 'diagram';
  }

  /**
   * Parse question from document fields (legacy format).
   * Used when questionDataFileId is not available.
   */
  private parseQuestionFromDocument(doc: PracticeQuestion): ParsedPracticeQuestion {
    let options: string[] | null = null;
    let acceptableAnswers: string[] | null = null;
    let outcomeRefs: string[] | null = null;

    if (doc.options) {
      try {
        options = JSON.parse(doc.options);
      } catch {
        console.warn('[PracticeQuestionDriver] Failed to parse options');
      }
    }

    if (doc.acceptableAnswers) {
      try {
        acceptableAnswers = JSON.parse(doc.acceptableAnswers);
      } catch {
        console.warn('[PracticeQuestionDriver] Failed to parse acceptableAnswers');
      }
    }

    if (doc.outcomeRefs) {
      try {
        outcomeRefs = JSON.parse(doc.outcomeRefs);
      } catch {
        console.warn('[PracticeQuestionDriver] Failed to parse outcomeRefs');
      }
    }

    const normalizedType = normalizeQuestionType(doc.questionType);

    return {
      question_id: doc.$id,
      lessonTemplateId: doc.lessonTemplateId,
      blockId: doc.blockId,
      blockTitle: doc.blockTitle,
      block_id: doc.blockId,           // Alias for contract compatibility
      block_title: doc.blockTitle,     // Alias for contract compatibility
      difficulty: doc.difficulty,
      questionType: normalizedType,
      question_type: normalizedType,   // Alias for contract (QuestionStep)
      stem: doc.stem || doc.stemPreview, // Fallback to preview
      stemPreview: doc.stemPreview,
      options,
      correctAnswer: doc.correctAnswer || '',
      correct_answer: doc.correctAnswer || '',
      acceptableAnswers,
      solutionFileId: doc.solutionFileId || '',
      hintsFileId: doc.hintsFileId || '',
      hints: [],
      diagramRequired: doc.diagramRequired,
      diagramTool: doc.diagramTool,
      diagramFileId: doc.diagramFileId,
      diagramJson: doc.diagramJson,
      outcomeRefs,
      outcome_refs: outcomeRefs,       // Alias for contract compatibility
      status: doc.status,
    };
  }

  /**
   * Load hints from storage file and merge into parsed question.
   * Non-blocking - returns question with empty hints if file loading fails.
   *
   * @param question - Parsed question with hintsFileId
   * @returns Question with hints populated
   */
  private async loadQuestionHints(question: ParsedPracticeQuestion): Promise<ParsedPracticeQuestion> {
    // Skip if hints already loaded from questionDataFile
    if (question.hints && question.hints.length > 0) {
      console.log('[PracticeQuestionDriver] Hints already loaded from data file');
      return question;
    }

    if (!question.hintsFileId) {
      console.log('[PracticeQuestionDriver] No hintsFileId, skipping load');
      return question;
    }

    try {
      const hints = await this.loadStorageFile<string[]>(question.hintsFileId);
      if (hints && Array.isArray(hints)) {
        console.log('[PracticeQuestionDriver] Loaded hints:', hints.length);
        return { ...question, hints };
      }
    } catch (error) {
      console.warn('[PracticeQuestionDriver] Failed to load hints:', error);
    }

    return question;
  }
  /**
   * Check if practice questions exist for a lesson template
   * Used for dashboard gray-out logic
   *
   * @param lessonTemplateId - Lesson template document ID
   * @returns QuestionAvailability with counts
   */
  async checkQuestionsAvailable(lessonTemplateId: string): Promise<QuestionAvailability> {
    try {
      console.log('[PracticeQuestionDriver] Checking questions for:', lessonTemplateId);

      const records = await this.list<PracticeQuestion>(QUESTIONS_COLLECTION_ID, [
        Query.equal('lessonTemplateId', lessonTemplateId),
        Query.equal('status', 'published'),
        Query.limit(500)
      ]);

      if (records.length === 0) {
        console.log('[PracticeQuestionDriver] No questions found');
        return {
          lessonTemplateId,
          hasQuestions: false,
          totalCount: 0,
          byDifficulty: { easy: 0, medium: 0, hard: 0 },
          byBlock: []
        };
      }

      const byDifficulty = { easy: 0, medium: 0, hard: 0 };
      const blockMap = new Map<string, { blockTitle: string; count: number }>();

      for (const q of records) {
        byDifficulty[q.difficulty]++;

        const existing = blockMap.get(q.blockId);
        if (existing) {
          existing.count++;
        } else {
          blockMap.set(q.blockId, { blockTitle: q.blockTitle, count: 1 });
        }
      }

      const byBlock = Array.from(blockMap.entries()).map(([blockId, data]) => ({
        blockId,
        blockTitle: data.blockTitle,
        count: data.count
      }));

      console.log('[PracticeQuestionDriver] Found questions:', {
        total: records.length,
        byDifficulty,
        blocks: byBlock.length
      });

      return {
        lessonTemplateId,
        hasQuestions: true,
        totalCount: records.length,
        byDifficulty,
        byBlock
      };
    } catch (error) {
      throw this.handleError(error, 'check questions available');
    }
  }

  /**
   * Get a random question for a block and difficulty
   * Excludes recently shown questions to ensure variety
   *
   * @param lessonTemplateId - Lesson template ID
   * @param blockId - Block ID
   * @param difficulty - Question difficulty
   * @param excludeIds - Question IDs to exclude (recently shown)
   * @returns RandomQuestionResult with question and pool metadata
   * @throws Error if no questions available (fast-fail)
   */
  async getRandomQuestion(
    lessonTemplateId: string,
    blockId: string,
    difficulty: 'easy' | 'medium' | 'hard',
    excludeIds: string[] = []
  ): Promise<RandomQuestionResult> {
    try {
      console.log('[PracticeQuestionDriver] Getting random question:', {
        lessonTemplateId,
        blockId,
        difficulty,
        excludeCount: excludeIds.length
      });

      const records = await this.list<PracticeQuestion>(QUESTIONS_COLLECTION_ID, [
        Query.equal('lessonTemplateId', lessonTemplateId),
        Query.equal('blockId', blockId),
        Query.equal('difficulty', difficulty),
        Query.equal('status', 'published'),
        Query.limit(50)
      ]);

      if (records.length === 0) {
        throw new Error(
          `No practice questions available for lesson=${lessonTemplateId}, ` +
          `block=${blockId}, difficulty=${difficulty}. ` +
          `Run: python -m claud_author_agent.cli.generate_practice_questions --lesson-id ${lessonTemplateId}`
        );
      }

      const poolSize = records.length;
      let poolReset = false;

      let available = records.filter(q => !excludeIds.includes(q.$id));

      if (available.length === 0) {
        console.log('[PracticeQuestionDriver] All questions excluded, resetting pool');
        available = [...records];
        poolReset = true;
      }

      const randomIndex = Math.floor(Math.random() * available.length);
      const selected = available[randomIndex];

      console.log('[PracticeQuestionDriver] Selected question:', selected.$id, { poolReset, poolSize });

      // Load full question data from storage file (stem, correct_answer, etc.)
      const parsed = await this.loadQuestionDataFile(selected);
      // Load additional hints if not already in data file
      const question = await this.loadQuestionHints(parsed);

      return { question, poolReset, poolSize };
    } catch (error) {
      throw this.handleError(error, 'get random question');
    }
  }

  /**
   * Get questions for a specific block (all difficulties)
   *
   * @param lessonTemplateId - Lesson template ID
   * @param blockId - Block ID
   * @returns Array of ParsedPracticeQuestion
   */
  async getQuestionsForBlock(
    lessonTemplateId: string,
    blockId: string
  ): Promise<ParsedPracticeQuestion[]> {
    try {
      console.log('[PracticeQuestionDriver] Getting questions for block:', { lessonTemplateId, blockId });

      const records = await this.list<PracticeQuestion>(QUESTIONS_COLLECTION_ID, [
        Query.equal('lessonTemplateId', lessonTemplateId),
        Query.equal('blockId', blockId),
        Query.equal('status', 'published'),
        Query.limit(100)
      ]);

      console.log('[PracticeQuestionDriver] Found questions:', records.length);

      // Load full question data from storage files in parallel
      const loadedQuestions = await Promise.all(
        records.map(q => this.loadQuestionDataFile(q))
      );

      // Load additional hints if not already in data files
      return Promise.all(loadedQuestions.map(q => this.loadQuestionHints(q)));
    } catch (error) {
      throw this.handleError(error, 'get questions for block');
    }
  }

  /**
   * Get all blocks for a lesson template
   *
   * @param lessonTemplateId - Lesson template ID
   * @returns Array of PracticeBlock sorted by blockIndex
   */
  async getBlocksForLesson(lessonTemplateId: string): Promise<PracticeBlock[]> {
    try {
      console.log('[PracticeQuestionDriver] Getting blocks for lesson:', lessonTemplateId);

      const records = await this.list<PracticeBlock>(BLOCKS_COLLECTION_ID, [
        Query.equal('lessonTemplateId', lessonTemplateId),
        Query.orderAsc('blockIndex'),
        Query.limit(50)
      ]);

      console.log('[PracticeQuestionDriver] Found blocks:', records.length);

      return records;
    } catch (error) {
      throw this.handleError(error, 'get blocks for lesson');
    }
  }

  /**
   * Get a specific question by ID
   *
   * @param questionId - Question document ID
   * @returns ParsedPracticeQuestion
   * @throws Error if not found (fast-fail)
   */
  async getQuestionById(questionId: string): Promise<ParsedPracticeQuestion> {
    try {
      console.log('[PracticeQuestionDriver] Getting question by ID:', questionId);

      const document = await this.get<PracticeQuestion>(QUESTIONS_COLLECTION_ID, questionId);

      // Load full question data from storage file
      const parsed = await this.loadQuestionDataFile(document);
      // Load additional hints if not already in data file
      return this.loadQuestionHints(parsed);
    } catch (error) {
      throw this.handleError(error, 'get question by ID');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCK CONTENT METHODS (for BlockReferencePanel)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Load enriched content for a block from storage files.
   * Used by BlockReferencePanel to display explanation, worked examples,
   * key formulas, and common misconceptions during practice.
   *
   * @param lessonTemplateId - Lesson template ID
   * @param blockId - Block ID to load content for
   * @returns ParsedBlockContent with full explanatory material
   * @throws Error if block not found (fast-fail, no fallback)
   */
  async getBlockContent(
    lessonTemplateId: string,
    blockId: string
  ): Promise<ParsedBlockContent> {
    try {
      console.log('[PracticeQuestionDriver] Getting block content:', {
        lessonTemplateId,
        blockId
      });

      // Query practice_blocks for the block document
      const blocks = await this.list<PracticeBlock>(BLOCKS_COLLECTION_ID, [
        Query.equal('lessonTemplateId', lessonTemplateId),
        Query.equal('blockId', blockId),
        Query.limit(1)
      ]);

      if (blocks.length === 0) {
        throw new Error(
          `Block ${blockId} not found for lesson ${lessonTemplateId}. ` +
          `Ensure practice content has been generated for this lesson.`
        );
      }

      const block = blocks[0];
      return this.parseBlockContent(block);
    } catch (error) {
      throw this.handleError(error, 'get block content');
    }
  }

  /**
   * Batch load content for multiple blocks (prefetching).
   * Used to preload upcoming block content while student is practicing.
   *
   * @param lessonTemplateId - Lesson template ID
   * @param blockIds - Array of block IDs to load
   * @returns Map of blockId -> ParsedBlockContent
   */
  async getBlockContentBatch(
    lessonTemplateId: string,
    blockIds: string[]
  ): Promise<Map<string, ParsedBlockContent>> {
    console.log('[PracticeQuestionDriver] Batch loading block content:', {
      lessonTemplateId,
      blockCount: blockIds.length
    });

    const result = new Map<string, ParsedBlockContent>();

    if (blockIds.length === 0) {
      return result;
    }

    try {
      // Query all requested blocks in one call
      const blocks = await this.list<PracticeBlock>(BLOCKS_COLLECTION_ID, [
        Query.equal('lessonTemplateId', lessonTemplateId),
        Query.limit(50)
      ]);

      // Filter to requested block IDs
      const requestedBlocks = blocks.filter(b => blockIds.includes(b.blockId));

      // Parse content in parallel
      const parsed = await Promise.all(
        requestedBlocks.map(block => this.parseBlockContent(block))
      );

      // Build result map
      for (const content of parsed) {
        result.set(content.blockId, content);
      }

      console.log('[PracticeQuestionDriver] Batch loaded blocks:', result.size);
      return result;
    } catch (error) {
      // Log error but don't throw - prefetching is best-effort
      console.warn('[PracticeQuestionDriver] Batch load error:', error);
      return result;
    }
  }

  /**
   * Parse a PracticeBlock document into ParsedBlockContent by loading the storage file.
   * Internal helper for getBlockContent and getBlockContentBatch.
   *
   * The block's `blockDataFileId` points to a SINGLE JSON file containing:
   * { explanation, worked_example, key_formulas, common_misconceptions }
   *
   * @param block - Raw block document from Appwrite
   * @returns ParsedBlockContent with all storage file content loaded
   * @throws Error if required file cannot be loaded (fast-fail, NO fallback)
   */
  private async parseBlockContent(block: PracticeBlock): Promise<ParsedBlockContent> {
    console.log('[PracticeQuestionDriver] Parsing block content:', {
      blockId: block.blockId,
      blockDataFileId: block.blockDataFileId,
      title: block.title
    });

    // Validate blockDataFileId exists
    if (!block.blockDataFileId) {
      throw new Error(
        `Block ${block.blockId} has no blockDataFileId. ` +
        `Block content cannot be loaded. Re-run practice content generation.`
      );
    }

    // Load the SINGLE block data file containing all content
    const blockData = await this.loadStorageFile<BlockDataFileContent>(block.blockDataFileId);

    // Fast-fail: No fallback if file loading fails
    if (!blockData) {
      throw new Error(
        `Failed to load block data file ${block.blockDataFileId} for block ${block.blockId}. ` +
        `Block content cannot be displayed. Verify the storage file exists in practice_content bucket.`
      );
    }

    // Validate required explanation is present in file
    if (!blockData.explanation) {
      throw new Error(
        `Block data file ${block.blockDataFileId} is missing explanation field. ` +
        `Block ${block.blockId} content is corrupted. Re-run practice content generation.`
      );
    }

    console.log('[PracticeQuestionDriver] Loaded block data file:', {
      blockId: block.blockId,
      hasExplanation: !!blockData.explanation,
      hasWorkedExample: !!blockData.worked_example,
      keyFormulasCount: blockData.key_formulas?.length || 0,
      misconceptionsCount: blockData.common_misconceptions?.length || 0
    });

    return {
      blockId: block.blockId,
      blockIndex: block.blockIndex,
      title: block.title,
      explanation: blockData.explanation,
      worked_example: blockData.worked_example || null,
      key_formulas: blockData.key_formulas || [],
      common_misconceptions: blockData.common_misconceptions || []
    };
  }
}
