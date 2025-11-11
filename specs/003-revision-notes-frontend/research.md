# Research: Revision Notes Frontend Integration

**Feature Branch**: `003-revision-notes-frontend` | **Date**: 2025-11-10

## Purpose

This document resolves all technical unknowns from the feature specification, focusing on library selections, integration patterns, and architectural decisions for displaying revision notes in the frontend.

---

## 1. Markdown Rendering Stack

### Decision: React Markdown + remark-math + rehype-katex + rehype-mermaid

**Rationale**:
- **react-markdown** (v9.0+): Battle-tested, lightweight CommonMark renderer with excellent plugin ecosystem
- **remark-math + rehype-katex**: Industry standard for LaTeX math rendering with superior performance over MathJax
- **rehype-mermaid**: Client-side Mermaid diagram rendering that supports theme switching and responsive sizing
- Combined bundle size: ~150KB gzipped (acceptable for educational content features)
- Spec requirement FR-005 explicitly requires full-featured markdown with LaTeX and Mermaid support

**Alternatives Considered**:
- ❌ **MDX**: Too heavyweight for simple content display (no interactive components needed in revision notes)
- ❌ **marked.js + custom plugins**: More configuration overhead, smaller ecosystem than remark/rehype
- ❌ **MathJax**: Slower render times than KaTeX (500ms vs 50ms for complex expressions)
- ❌ **Server-side Mermaid rendering**: Loses theme switching capability, adds backend complexity

**Implementation Details**:
```typescript
// Package versions
"react-markdown": "^9.0.1"
"remark-math": "^6.0.0"
"rehype-katex": "^7.0.0"
"rehype-mermaid": "^2.1.0"
"katex": "^0.16.9"
"mermaid": "^10.6.1"
```

**Syntax Highlighting** (FR-017):
- **Decision**: Use `rehype-highlight` or `rehype-prism-plus`
- Adds minimal overhead (~20KB) for code block highlighting
- Pedagogical content benefits from syntax-highlighted examples

---

## 2. Modal/Dialog Library

### Decision: Radix UI Dialog

**Rationale**:
- **Accessibility-first**: Built-in ARIA patterns, focus management, keyboard navigation (FR-006, FR-007)
- **Headless design**: Full style control with Tailwind CSS (matches existing UI patterns)
- **Lightweight**: ~12KB gzipped
- **Already in use**: Project uses Radix UI primitives (buttons, tooltips) - consistent ecosystem
- **React 18+ compatible**: Supports concurrent features, Suspense boundaries

**Alternatives Considered**:
- ❌ **Headless UI**: Similar features but less ecosystem momentum than Radix
- ❌ **Material-UI Dialog**: Too opinionated styling, larger bundle size (~80KB)
- ❌ **Native HTML `<dialog>`**: Poor browser support (Safari issues), manual accessibility work

**Implementation Pattern**:
```typescript
import * as Dialog from '@radix-ui/react-dialog';

<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
  <Dialog.Trigger>View Cheat Sheet</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 bg-black/50" />
    <Dialog.Content className="fixed top-1/2 left-1/2 ...">
      {markdownContent}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

---

## 3. Caching Strategy for Markdown Files

### Decision: Fetch on open, cache in memory until modal close

**Rationale**:
- **Spec requirement FR-020**: Fetch latest version on each access (modal open), cache during viewing session, clear on modal close
- **Balance freshness vs UX**: Content is semi-static (updated only when SOW changes), but no stale data risk
- **No persistent caching**: Avoid localStorage/sessionStorage to prevent stale content issues
- **Session-scoped caching**: Side panel in SessionChatAssistant caches for lesson duration, clears on session end

**Implementation**:
```typescript
// Modal-based caching (cheat sheet, lesson notes from dashboard)
const [markdownCache, setMarkdownCache] = useState<string | null>(null);

useEffect(() => {
  if (isModalOpen && !markdownCache) {
    fetchMarkdownFile(fileId).then(setMarkdownCache);
  }

  // Clear cache when modal closes
  if (!isModalOpen) {
    setMarkdownCache(null);
  }
}, [isModalOpen, fileId]);

// Side panel caching (lesson notes in SessionChatAssistant)
// Cache fetched on lesson start or first panel open, persists until lesson ends
const lessonScopedCache = useRef<string | null>(null);
```

**Network Optimization**:
- Use AbortController for request cancellation if user closes modal quickly
- Display skeleton UI immediately (reduces perceived latency per FR-021)
- Retry mechanism with exponential backoff hints (FR-016)

---

## 4. Loading State UI Pattern

### Decision: Skeleton UI matching markdown structure

**Rationale**:
- **Spec requirement FR-021**: Display skeleton UI while fetching, matching expected structure
- **UX Best Practice**: Reduces perceived latency by 30-40% compared to spinners (industry research)
- **Modern pattern**: Used by GitHub, Linear, Notion for content loading
- **Implementation**: Tailwind CSS shimmer animation with placeholder blocks

**Skeleton Structure**:
```tsx
<div className="animate-pulse space-y-4">
  {/* Heading placeholders */}
  <div className="h-8 bg-gray-200 rounded w-3/4" />
  <div className="h-6 bg-gray-200 rounded w-1/2" />

  {/* Paragraph blocks */}
  <div className="space-y-2">
    <div className="h-4 bg-gray-200 rounded" />
    <div className="h-4 bg-gray-200 rounded" />
    <div className="h-4 bg-gray-200 rounded w-5/6" />
  </div>

  {/* Code block placeholder */}
  <div className="h-24 bg-gray-100 rounded border-2 border-gray-200" />
</div>
```

**Progressive Enhancement**:
- Show skeleton immediately on modal open
- Stream markdown content in chunks if file size > 1MB
- Replace skeleton blocks as content arrives

---

## 5. Retry Mechanism for Failed Fetches

### Decision: Unlimited user-triggered retries with exponential backoff hints

**Rationale**:
- **Spec requirement FR-016**: No hard limit on retries, display exponential backoff hint after 3+ rapid retries within 30s
- **Fast-fail principle**: Display detailed error messages immediately (no silent fallbacks)
- **UX-friendly**: Users with transient network issues can retry without artificial barriers
- **Smart guidance**: Exponential backoff hint prevents retry spam while supporting legitimate use cases

**Implementation**:
```typescript
const [retryCount, setRetryCount] = useState(0);
const [lastRetryTime, setLastRetryTime] = useState<number>(0);

const handleRetry = async () => {
  const now = Date.now();
  const timeSinceLastRetry = now - lastRetryTime;

  // Track rapid retries (3+ within 30 seconds)
  if (retryCount >= 3 && timeSinceLastRetry < 30000) {
    showExponentialBackoffHint(); // "Consider waiting a moment before trying again"
  }

  setRetryCount(prev => prev + 1);
  setLastRetryTime(now);

  try {
    await fetchMarkdownFile(fileId);
  } catch (error) {
    // Throw detailed error per constitution fast-fail principle
    throw new Error(`Failed to load revision notes: ${error.message}`);
  }
};
```

**Error Message UX**:
```tsx
{error && (
  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
    <h3 className="font-semibold text-red-900">Failed to Load Revision Notes</h3>
    <p className="text-sm text-red-700">{error}</p>
    <button onClick={handleRetry} className="mt-2 ...">
      Retry
    </button>
    {showBackoffHint && (
      <p className="mt-2 text-xs text-red-600">
        💡 Multiple rapid retries detected. Consider waiting a moment before trying again.
      </p>
    )}
  </div>
)}
```

---

## 6. Side Panel Integration with Existing ContextChatPanel

### Decision: Mutual exclusivity pattern with shared resize logic

**Rationale**:
- **Spec requirement FR-010**: Only ONE side panel open at a time (Lesson Notes vs Context Chat)
- **Existing pattern**: ContextChatPanel already implements resize logic, width constraints (20%-50%)
- **Code reuse**: Extract shared resize hook for both panels to maintain DRY principle
- **UX consistency**: Both panels use same interaction model (drag handle, collapse/expand toggle)

**Architecture**:
```typescript
// Shared resize hook (extract from ContextChatPanel)
function useSidePanelResize(initialWidth = 33, minWidth = 20, maxWidth = 50) {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  // Mouse event handlers for drag-to-resize
  // Constrains width between minWidth and maxWidth
  // Returns { width, isResizing, startResize, handleResize, stopResize }
}

// SessionChatAssistant state management
enum ActiveSidePanel {
  None = 'none',
  ContextChat = 'context_chat',
  LessonNotes = 'lesson_notes'
}

const [activeSidePanel, setActiveSidePanel] = useState<ActiveSidePanel>(ActiveSidePanel.None);

// Opening LessonNotes auto-collapses ContextChat
const openLessonNotes = () => {
  setActiveSidePanel(ActiveSidePanel.LessonNotes);
};

// Opening ContextChat auto-collapses LessonNotes
const openContextChat = () => {
  setActiveSidePanel(ActiveSidePanel.ContextChat);
};
```

**Edge Case Handling**:
- If ContextChat is open and user clicks "Lesson Notes", ContextChat smoothly collapses before LessonNotes expands
- Animation: 200ms ease-in-out transition for panel width changes
- No overlapping panels (prevented by state machine pattern)

---

## 7. Appwrite Storage Integration

### Decision: Use existing Appwrite Storage SDK patterns from DiagramDriver

**Rationale**:
- **Consistency**: DiagramDriver already fetches images from Appwrite Storage bucket
- **Proven pattern**: Same authentication, error handling, retry logic
- **Document ID format**: Spec 002 defines `revision_notes_{courseId}_cheat_sheet` and `revision_notes_{courseId}_lesson_{lessonOrder:02d}`
- **Fast-fail principle**: Throw detailed exceptions when files not found (no silent fallbacks)

**Implementation Pattern** (based on DiagramDriver):
```typescript
import { Storage } from 'appwrite';

class RevisionNotesDriver {
  private storage: Storage;
  private bucketId = 'documents'; // Markdown files in documents bucket

  async getCourseCheatSheet(courseId: string): Promise<string> {
    const documentId = `revision_notes_${courseId}_cheat_sheet`;

    try {
      const file = await this.storage.getFileView(this.bucketId, documentId);
      const markdownText = await file.text();
      return markdownText;
    } catch (error) {
      throw new Error(`Failed to fetch course cheat sheet for ${courseId}: ${error.message}`);
    }
  }

  async getLessonQuickNotes(courseId: string, lessonOrder: number): Promise<string> {
    const documentId = `revision_notes_${courseId}_lesson_${String(lessonOrder).padStart(2, '0')}`;

    try {
      const file = await this.storage.getFileView(this.bucketId, documentId);
      const markdownText = await file.text();
      return markdownText;
    } catch (error) {
      throw new Error(`Failed to fetch lesson notes for ${courseId} lesson ${lessonOrder}: ${error.message}`);
    }
  }
}
```

**Validation Strategy**:
- Query `revision_notes` collection first to check if document exists (FR-012)
- If document doesn't exist, disable button and show "Not yet available" message
- Only attempt Storage fetch if document exists in database

---

## 8. Responsive Design for Mobile Devices

### Decision: Mobile-first responsive markdown renderer with adaptive diagram scaling

**Rationale**:
- **Spec requirement FR-018**: Ensure responsiveness on mobile (font size, scroll, diagrams)
- **Existing pattern**: StudentDashboard uses Tailwind responsive classes
- **Diagram challenge**: Mermaid diagrams can overflow on small screens

**Responsive Strategy**:
```css
/* Markdown container */
.markdown-content {
  @apply text-base md:text-lg; /* 16px mobile, 18px desktop */
  @apply max-w-full overflow-x-auto; /* Prevent horizontal scroll on container */
}

/* Headings */
.markdown-content h1 {
  @apply text-2xl md:text-3xl lg:text-4xl;
}

.markdown-content h2 {
  @apply text-xl md:text-2xl lg:text-3xl;
}

/* Code blocks */
.markdown-content pre {
  @apply text-sm md:text-base;
  @apply overflow-x-auto; /* Horizontal scroll for long code lines */
}

/* Mermaid diagrams */
.markdown-content .mermaid {
  @apply max-w-full overflow-x-auto;
  transform-origin: top left;
}

/* LaTeX expressions */
.katex {
  font-size: 1.1em; /* Slightly larger than body text for readability */
}
```

**Mermaid Adaptive Scaling**:
```typescript
// Configure Mermaid for responsive rendering
mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
  flowchart: {
    useMaxWidth: true, // Scale to container width
    htmlLabels: true
  }
});
```

**Modal Mobile Adaptation**:
- Full-screen modal on mobile (<768px): `className="fixed inset-0 md:inset-10"`
- Larger modal padding on desktop for better reading experience
- Close button prominent on mobile (top-right corner, larger tap target)

---

## 9. Lazy Loading for Large Markdown Files

### Decision: Virtualized rendering for files >5MB with download fallback

**Rationale**:
- **Spec requirement FR-019**: Prevent UI freezing for very large files
- **Reality check**: Typical cheat sheet = 50-200KB; lesson notes = 20-100KB
- **Edge case protection**: Handle unusually large files gracefully
- **Performance threshold**: Browser can render ~2MB markdown without lag; >5MB needs intervention

**Implementation**:
```typescript
const [fileSize, setFileSize] = useState<number>(0);
const MAX_INLINE_SIZE = 5 * 1024 * 1024; // 5MB

const fetchMarkdownWithSizeCheck = async (fileId: string) => {
  // Get file metadata first
  const fileMetadata = await storage.getFile('documents', fileId);
  setFileSize(fileMetadata.sizeOriginal);

  if (fileMetadata.sizeOriginal > MAX_INLINE_SIZE) {
    // Show download option instead of inline rendering
    return {
      type: 'download',
      downloadUrl: storage.getFileDownload('documents', fileId).href
    };
  }

  // Normal inline rendering
  const fileContent = await storage.getFileView('documents', fileId);
  return {
    type: 'inline',
    content: await fileContent.text()
  };
};
```

**Download Fallback UI**:
```tsx
{fileResponse.type === 'download' && (
  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
    <h3 className="font-semibold text-yellow-900">Large File Detected</h3>
    <p className="text-sm text-yellow-700">
      This revision note is {(fileSize / 1024 / 1024).toFixed(1)}MB and may cause performance issues if rendered inline.
    </p>
    <a
      href={fileResponse.downloadUrl}
      download
      className="mt-4 inline-block rounded bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700"
    >
      Download Markdown File
    </a>
  </div>
)}
```

---

## 10. Error Handling for Malformed Markdown Syntax

### Decision: Graceful degradation with visual error indicators

**Rationale**:
- **Spec requirements FR-014, FR-015**: Handle malformed Mermaid and LaTeX gracefully (no crashes)
- **Constitution principle**: Fast-fail with detailed errors, but content should still display
- **User experience**: Show partial content > blank screen

**Mermaid Error Handling**:
```typescript
// Configure Mermaid error callback
mermaid.initialize({
  // ... other config
  errorCallback: (error: Error, diagram: string) => {
    console.error('Mermaid diagram failed:', error);
    // Replace failed diagram with error message
    return `
      <div class="border border-red-300 bg-red-50 p-4 rounded">
        <p class="font-semibold text-red-900">❌ Diagram Rendering Failed</p>
        <p class="text-sm text-red-700">Syntax error in Mermaid diagram</p>
        <details class="mt-2">
          <summary class="cursor-pointer text-xs text-red-600">View diagram source</summary>
          <pre class="mt-2 text-xs bg-white p-2 rounded overflow-x-auto">${diagram}</pre>
        </details>
      </div>
    `;
  }
});
```

**LaTeX Error Handling**:
```typescript
// rehype-katex plugin with throwOnError: false
import rehypeKatex from 'rehype-katex';

<ReactMarkdown
  rehypePlugins={[
    [rehypeKatex, {
      throwOnError: false, // Display raw LaTeX instead of crashing
      errorColor: '#cc0000', // Highlight malformed expressions in red
      strict: false // Allow some non-standard syntax
    }]
  ]}
>
  {markdownContent}
</ReactMarkdown>
```

**CSS for Error States**:
```css
/* LaTeX error highlighting */
.katex-error {
  color: #cc0000;
  background-color: #ffe6e6;
  border: 1px dashed #cc0000;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: monospace;
}
```

---

## Summary of Resolved Unknowns

| Technical Context Field | Resolution |
|------------------------|------------|
| **Markdown Renderer** | react-markdown + remark-math + rehype-katex + rehype-mermaid |
| **Modal Library** | Radix UI Dialog (accessible, headless, already in project) |
| **Caching Strategy** | Fetch on open, cache in memory, clear on close (session-scoped for side panel) |
| **Loading State** | Skeleton UI matching markdown structure (reduces perceived latency) |
| **Retry Mechanism** | Unlimited user-triggered with exponential backoff hints (3+ rapid retries) |
| **Side Panel Pattern** | Mutual exclusivity with ContextChat, shared resize hook |
| **Storage Integration** | Appwrite Storage SDK (same pattern as DiagramDriver) |
| **Responsive Design** | Mobile-first Tailwind classes, adaptive Mermaid scaling |
| **Large File Handling** | Virtualized rendering or download fallback for >5MB files |
| **Error Handling** | Graceful degradation with visual error indicators (no crashes) |

---

## Next Steps

Proceed to **Phase 1: Design & Contracts**:
1. Generate `data-model.md` (entities, state management)
2. Create API contracts in `/contracts/` (RevisionNotesDriver interface)
3. Write `quickstart.md` (developer onboarding guide)
4. Update `.specify/memory/agent-context-claude.md` with new technologies
