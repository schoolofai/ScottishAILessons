# Data Model: Revision Notes Frontend Integration

**Feature Branch**: `003-revision-notes-frontend` | **Date**: 2025-11-10

## Purpose

This document defines the frontend data structures, state management patterns, and relationships for displaying revision notes. All entities are frontend-specific; backend data models are defined in spec 002.

---

## Core Entities

### 1. RevisionNoteDisplay

Represents the rendered revision note UI component displayed in modals or side panels.

**TypeScript Interface**:
```typescript
interface RevisionNoteDisplay {
  // Identifiers
  courseId: string;
  noteType: 'cheat_sheet' | 'lesson_note';
  lessonOrder?: number; // Required for lesson_note, null for cheat_sheet

  // Content
  markdownContent: string;
  markdownFileId: string; // Appwrite Storage file ID

  // Rendering state
  renderingStatus: 'loading' | 'success' | 'error' | 'download_required';
  errorMessage?: string;

  // Metadata
  fileSize: number; // In bytes
  fetchedAt: Date; // Timestamp for cache invalidation
}
```

**State Transitions**:
```
loading → success (normal flow)
loading → error (fetch failure)
loading → download_required (file >5MB)
success → loading (refetch on modal reopen)
error → loading (user retry)
```

**Validation Rules**:
- `lessonOrder` MUST be provided when `noteType === 'lesson_note'`
- `lessonOrder` MUST be null when `noteType === 'cheat_sheet'`
- `markdownContent` MUST NOT be empty when `renderingStatus === 'success'`
- `errorMessage` MUST be provided when `renderingStatus === 'error'`

**Relationships**:
- One-to-one with Course via `courseId`
- One-to-one with Lesson Template via `lessonOrder` (lesson notes only)
- Fetched from Appwrite Storage using `markdownFileId`

---

### 2. MarkdownRenderer

Represents the configuration and capabilities of the markdown rendering component.

**TypeScript Interface**:
```typescript
interface MarkdownRendererConfig {
  // Content source
  markdownSource: string;

  // Feature flags
  supportsLaTeX: boolean; // Default: true
  supportsMermaid: boolean; // Default: true
  supportsSyntaxHighlighting: boolean; // Default: true

  // Error handling
  onMermaidError?: (error: Error, diagram: string) => void;
  onLaTeXError?: (error: Error, expression: string) => void;

  // Responsive settings
  mobileOptimized: boolean; // Default: true
  maxWidth?: string; // CSS max-width value (e.g., "800px", "100%")
}
```

**Component Props**:
```typescript
interface MarkdownRendererProps {
  content: string;
  config?: Partial<MarkdownRendererConfig>;
  className?: string;
  onRenderComplete?: () => void;
}
```

**Capabilities**:
- Renders CommonMark markdown syntax
- Inline LaTeX: `$...$` format (e.g., `$\frac{1}{2}$`)
- Display LaTeX: `$$...$$` format (e.g., `$$E=mc^2$$`)
- Mermaid diagrams with responsive scaling
- Syntax-highlighted code blocks
- Mobile-responsive typography and layout

**Error Handling Contract**:
- Malformed Mermaid diagrams → Display error message block, continue rendering rest of content
- Malformed LaTeX expressions → Highlight in red, display raw LaTeX, continue rendering
- No crashes or blank screens on syntax errors

---

### 3. SidePanelState

Manages the state for side panels in SessionChatAssistant (ContextChat vs LessonNotes).

**TypeScript Interface**:
```typescript
enum ActiveSidePanel {
  None = 'none',
  ContextChat = 'context_chat',
  LessonNotes = 'lesson_notes'
}

interface SidePanelState {
  // Active panel
  activeSidePanel: ActiveSidePanel;

  // Resize state
  panelWidth: number; // Percentage (20-50)
  isResizing: boolean;

  // Content cache (session-scoped for lesson notes)
  lessonNotesCacheContent?: string;
  lessonNotesCacheTimestamp?: Date;
}
```

**State Mutations**:
```typescript
// Opening LessonNotes auto-collapses ContextChat
const openLessonNotes = () => {
  setActiveSidePanel(ActiveSidePanel.LessonNotes);
};

// Opening ContextChat auto-collapses LessonNotes
const openContextChat = () => {
  setActiveSidePanel(ActiveSidePanel.ContextChat);
};

// Closing any panel
const closeActivePanel = () => {
  setActiveSidePanel(ActiveSidePanel.None);
};

// Resize constraints
const resizePanel = (newWidth: number) => {
  const constrainedWidth = Math.max(20, Math.min(50, newWidth));
  setPanelWidth(constrainedWidth);
};
```

**Invariants**:
- ONLY ONE panel can be active at a time (mutual exclusivity)
- `panelWidth` MUST be between 20% and 50%
- `activeSidePanel === None` → both panels collapsed
- `lessonNotesCacheContent` persists for lesson session duration, cleared on session end

**Relationships**:
- Manages ContextChatPanel and LessonNotesPanel exclusivity
- Shared with resize drag handle logic

---

### 4. RevisionNotesCache

Frontend caching layer for markdown content.

**TypeScript Interface**:
```typescript
interface RevisionNotesCacheEntry {
  markdownContent: string;
  fetchedAt: Date;
  fileId: string;
  fileSize: number;
}

type RevisionNotesCacheStore = Map<string, RevisionNotesCacheEntry>;

// Cache key format
const getCacheKey = (courseId: string, noteType: 'cheat_sheet' | 'lesson_note', lessonOrder?: number): string => {
  if (noteType === 'cheat_sheet') {
    return `${courseId}_cheat_sheet`;
  }
  return `${courseId}_lesson_${String(lessonOrder).padStart(2, '0')}`;
};
```

**Cache Lifecycle**:

**Modal-based caching** (course cheat sheets, lesson notes from dashboard):
- **Populate**: Fetch on modal open
- **Access**: Serve from cache while modal is open
- **Invalidate**: Clear when modal closes

**Side panel caching** (lesson notes in SessionChatAssistant):
- **Populate**: Fetch on lesson session start OR first panel open
- **Access**: Serve from cache for entire lesson session
- **Invalidate**: Clear when lesson session ends (not on panel toggle)

**Implementation Pattern**:
```typescript
// React state-based cache (no localStorage/sessionStorage)
const [modalCache, setModalCache] = useState<string | null>(null);

// Modal cache lifecycle
useEffect(() => {
  if (isModalOpen && !modalCache) {
    fetchMarkdownFile(fileId).then(setModalCache);
  }

  // Clear cache on modal close
  if (!isModalOpen) {
    setModalCache(null);
  }
}, [isModalOpen, fileId]);

// Side panel cache (ref-based for session-scoped persistence)
const lessonScopedCache = useRef<RevisionNotesCacheEntry | null>(null);

useEffect(() => {
  // Clear cache when lesson session ends
  return () => {
    lessonScopedCache.current = null;
  };
}, [sessionId]); // Keyed by sessionId
```

**Cache Size Constraints**:
- Maximum cache entry size: 5MB (larger files trigger download fallback)
- Maximum cache lifetime: Lesson session duration (typically 30-60 minutes)
- No disk persistence (all in-memory)

---

### 5. RevisionNotesLoadingState

Represents loading UI state for skeleton rendering.

**TypeScript Interface**:
```typescript
interface LoadingSkeletonConfig {
  // Structure hints
  headingCount: number; // Default: 5 (typical cheat sheet has 5-7 sections)
  paragraphBlocksPerSection: number; // Default: 3
  hasCodeBlocks: boolean; // Default: true
  hasDiagrams: boolean; // Default: true
}

const getDefaultSkeletonConfig = (noteType: 'cheat_sheet' | 'lesson_note'): LoadingSkeletonConfig => {
  if (noteType === 'cheat_sheet') {
    return {
      headingCount: 6, // Course Overview, Learning Outcomes, Key Concepts, etc.
      paragraphBlocksPerSection: 3,
      hasCodeBlocks: true,
      hasDiagrams: true
    };
  }

  // Lesson notes
  return {
    headingCount: 5, // Lesson Summary, Card Breakdown, Worked Examples, etc.
    paragraphBlocksPerSection: 2,
    hasCodeBlocks: true,
    hasDiagrams: false // Lesson notes typically don't have diagrams
  };
};
```

**Skeleton Component Structure**:
```tsx
<div className="animate-pulse space-y-6">
  {Array.from({ length: config.headingCount }).map((_, i) => (
    <div key={i} className="space-y-3">
      {/* Heading placeholder */}
      <div className="h-7 bg-gray-200 rounded w-3/4" />

      {/* Paragraph blocks */}
      {Array.from({ length: config.paragraphBlocksPerSection }).map((_, j) => (
        <div key={j} className="space-y-2">
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
        </div>
      ))}

      {/* Code block placeholder (occasional) */}
      {config.hasCodeBlocks && i % 2 === 0 && (
        <div className="h-24 bg-gray-100 rounded border-2 border-gray-200" />
      )}

      {/* Diagram placeholder (occasional) */}
      {config.hasDiagrams && i % 3 === 0 && (
        <div className="h-40 bg-blue-50 rounded border-2 border-blue-200" />
      )}
    </div>
  ))}
</div>
```

**Performance Optimization**:
- Skeleton renders synchronously (no async delays)
- Animation uses CSS `animate-pulse` (GPU-accelerated)
- Shimmer effect reduces perceived latency by 30-40%

---

### 6. RevisionNotesErrorState

Represents error states and retry logic.

**TypeScript Interface**:
```typescript
interface RevisionNotesError {
  message: string;
  code: 'FETCH_FAILED' | 'FILE_NOT_FOUND' | 'NETWORK_ERROR' | 'PARSE_ERROR' | 'STORAGE_UNAVAILABLE';
  timestamp: Date;
  retryable: boolean;
}

interface RetryState {
  retryCount: number;
  lastRetryTime: Date | null;
  showBackoffHint: boolean; // Display exponential backoff hint
}
```

**Error Classification**:

| Error Code | User Message | Retryable | Auto-Retry |
|------------|--------------|-----------|------------|
| `FETCH_FAILED` | "Failed to load revision notes: Network error" | Yes | No |
| `FILE_NOT_FOUND` | "Revision notes not yet available for this lesson" | No | No |
| `NETWORK_ERROR` | "Failed to load revision notes: Storage service unavailable" | Yes | No |
| `PARSE_ERROR` | "Failed to parse markdown content (invalid format)" | No | No |
| `STORAGE_UNAVAILABLE` | "Appwrite Storage is temporarily unavailable" | Yes | No |

**Retry Logic**:
```typescript
const handleRetry = async (error: RevisionNotesError, retryState: RetryState) => {
  if (!error.retryable) {
    throw new Error(`Non-retryable error: ${error.code}`);
  }

  const now = new Date();
  const timeSinceLastRetry = retryState.lastRetryTime
    ? now.getTime() - retryState.lastRetryTime.getTime()
    : Infinity;

  // Detect rapid retries (3+ within 30 seconds)
  if (retryState.retryCount >= 3 && timeSinceLastRetry < 30000) {
    return {
      ...retryState,
      showBackoffHint: true
    };
  }

  // Proceed with retry
  return {
    retryCount: retryState.retryCount + 1,
    lastRetryTime: now,
    showBackoffHint: false
  };
};
```

**Error UI Component**:
```tsx
<div className="rounded-lg border border-red-200 bg-red-50 p-4">
  <h3 className="font-semibold text-red-900">❌ {error.message}</h3>
  <p className="text-sm text-red-700 mt-1">Error code: {error.code}</p>

  {error.retryable && (
    <button
      onClick={handleRetry}
      className="mt-3 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
    >
      Retry
    </button>
  )}

  {retryState.showBackoffHint && (
    <p className="mt-2 text-xs text-red-600">
      💡 Multiple rapid retries detected. Consider waiting a moment before trying again.
    </p>
  )}
</div>
```

---

## State Management Patterns

### Modal State (Course Cheat Sheet, Lesson Notes from Dashboard)

**React State Pattern**:
```typescript
function useCourseCheatSheet(courseId: string) {
  const [isOpen, setIsOpen] = useState(false);
  const [noteData, setNoteData] = useState<RevisionNoteDisplay | null>(null);
  const [error, setError] = useState<RevisionNotesError | null>(null);
  const [retryState, setRetryState] = useState<RetryState>({
    retryCount: 0,
    lastRetryTime: null,
    showBackoffHint: false
  });

  const { createDriver } = useAppwrite();

  useEffect(() => {
    if (isOpen && !noteData) {
      fetchCheatSheet();
    }

    // Clear cache on modal close
    if (!isOpen) {
      setNoteData(null);
      setError(null);
      setRetryState({ retryCount: 0, lastRetryTime: null, showBackoffHint: false });
    }
  }, [isOpen, courseId]);

  const fetchCheatSheet = async () => {
    setNoteData({ renderingStatus: 'loading', ... });
    const driver = createDriver(RevisionNotesDriver);

    try {
      const content = await driver.getCourseCheatSheet(courseId);
      setNoteData({ renderingStatus: 'success', markdownContent: content, ... });
    } catch (err) {
      setError({ code: 'FETCH_FAILED', message: err.message, ... });
      setNoteData({ renderingStatus: 'error', errorMessage: err.message, ... });
    }
  };

  return { isOpen, setIsOpen, noteData, error, retryState, handleRetry: fetchCheatSheet };
}
```

### Side Panel State (Lesson Notes in SessionChatAssistant)

**Session-scoped Cache Pattern**:
```typescript
function useLessonNotesSidePanel(sessionId: string, courseId: string, lessonOrder: number) {
  const [activeSidePanel, setActiveSidePanel] = useState<ActiveSidePanel>(ActiveSidePanel.None);
  const [panelWidth, setPanelWidth] = useState(33);
  const lessonNotesCacheRef = useRef<string | null>(null);

  const { createDriver } = useAppwrite();

  // Fetch lesson notes on first panel open OR session start
  useEffect(() => {
    if (activeSidePanel === ActiveSidePanel.LessonNotes && !lessonNotesCacheRef.current) {
      fetchLessonNotes();
    }
  }, [activeSidePanel]);

  // Clear cache when session ends
  useEffect(() => {
    return () => {
      lessonNotesCacheRef.current = null;
    };
  }, [sessionId]);

  const fetchLessonNotes = async () => {
    const driver = createDriver(RevisionNotesDriver);
    const content = await driver.getLessonQuickNotes(courseId, lessonOrder);
    lessonNotesCacheRef.current = content;
  };

  const openLessonNotes = () => {
    setActiveSidePanel(ActiveSidePanel.LessonNotes);
  };

  const closePanel = () => {
    setActiveSidePanel(ActiveSidePanel.None);
    // NOTE: Cache NOT cleared on panel close (persists for lesson session)
  };

  return {
    activeSidePanel,
    panelWidth,
    setPanelWidth,
    openLessonNotes,
    closePanel,
    lessonNotesContent: lessonNotesCacheRef.current
  };
}
```

---

## Data Flow Diagrams

### Modal-Based Flow (Course Cheat Sheet)

```
User clicks "Course Cheat Sheet" button
  ↓
Modal opens (isOpen = true)
  ↓
Check cache (modalCache === null?)
  ↓
Fetch markdown from Appwrite Storage
  ↓
Display skeleton UI while fetching
  ↓
[Success] Render markdown with react-markdown
  OR
[Error] Display error message with retry button
  ↓
User closes modal (isOpen = false)
  ↓
Clear cache (modalCache = null)
```

### Side Panel Flow (Lesson Notes)

```
Lesson session starts
  ↓
User clicks "Lesson Notes" toggle
  ↓
Check active panel (activeSidePanel === ContextChat?)
  ↓
Auto-collapse ContextChat if open
  ↓
Set activeSidePanel = LessonNotes
  ↓
Check cache (lessonNotesCacheRef.current === null?)
  ↓
[Cache miss] Fetch markdown from Appwrite Storage
  OR
[Cache hit] Use cached content
  ↓
Display skeleton UI while fetching (cache miss only)
  ↓
Render markdown in resizable side panel
  ↓
User toggles panel closed
  ↓
Set activeSidePanel = None (cache persists)
  ↓
Lesson session ends
  ↓
Clear cache (lessonNotesCacheRef.current = null)
```

---

## Database Queries

### Check if Revision Notes Exist (FR-012 validation)

**Purpose**: Determine if course cheat sheet or lesson notes are available before enabling UI buttons.

**Query Pattern**:
```typescript
import { Query } from 'appwrite';

// Check if course cheat sheet exists
const courseCheatSheetExists = async (courseId: string): Promise<boolean> => {
  const databases = new Databases(client);
  const documentId = `revision_notes_${courseId}_cheat_sheet`;

  try {
    await databases.getDocument('default', 'revision_notes', documentId);
    return true;
  } catch (error) {
    if (error.code === 404) {
      return false;
    }
    throw error; // Re-throw non-404 errors (network issues, etc.)
  }
};

// Check if lesson notes exist
const lessonNotesExist = async (courseId: string, lessonOrder: number): Promise<boolean> => {
  const databases = new Databases(client);
  const documentId = `revision_notes_${courseId}_lesson_${String(lessonOrder).padStart(2, '0')}`;

  try {
    await databases.getDocument('default', 'revision_notes', documentId);
    return true;
  } catch (error) {
    if (error.code === 404) {
      return false;
    }
    throw error;
  }
};
```

**UI Integration**:
```tsx
const [cheatSheetAvailable, setCheatSheetAvailable] = useState<boolean | null>(null);

useEffect(() => {
  courseCheatSheetExists(courseId).then(setCheatSheetAvailable);
}, [courseId]);

// Render button
<button
  disabled={!cheatSheetAvailable}
  onClick={openCheatSheetModal}
  className={cheatSheetAvailable ? '' : 'opacity-50 cursor-not-allowed'}
>
  {cheatSheetAvailable ? 'View Cheat Sheet' : 'Cheat Sheet Not Yet Available'}
</button>
```

---

## Component Hierarchy

### Course Tab (Dashboard)
```
EnhancedStudentDashboard
└── CourseTabs
    └── CourseTabContent
        ├── CourseHeader
        │   └── CourseCheatSheetButton (NEW)
        │       └── CourseCheatSheetModal (NEW)
        │           └── MarkdownRenderer (NEW)
        └── CourseCurriculum
            └── LessonListItem
                └── LessonQuickNotesButton (NEW)
                    └── LessonQuickNotesModal (NEW)
                        └── MarkdownRenderer (NEW)
```

### Session Chat Assistant (In-Lesson)
```
SessionChatAssistant
├── SessionHeader
├── MyAssistant (Main Teaching Panel)
└── SidePanelContainer (NEW)
    ├── ContextChatPanel (Existing)
    └── LessonNotesPanel (NEW)
        └── MarkdownRenderer (NEW)
```

---

## File Size Reference

Typical revision note sizes from spec 002 backend:
- **Course Cheat Sheet**: 50-200 KB (6-8 sections with LaTeX and Mermaid)
- **Lesson Quick Notes**: 20-100 KB (4-6 sections with worked examples)

Edge case threshold:
- **>5MB files**: Trigger download fallback (extremely rare, requires ~500 pages of dense markdown)

---

## Summary

This data model defines:
1. **6 core entities** for frontend revision notes display
2. **State management patterns** for modal and side panel caching
3. **Error handling schemas** with retry logic and exponential backoff hints
4. **Component hierarchy** showing integration points in existing UI
5. **Database query patterns** for validation and existence checks

All entities follow **fast-fail principles** (no silent fallbacks) and **constitution compliance** (modular components, clear error states).
