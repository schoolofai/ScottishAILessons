# Lesson Session History Persistence Plan (REVISED)

**Date**: 2025-10-28
**Status**: IMPLEMENTATION APPROVED
**Goal**: Persist complete conversation history (messages + tool calls) for session replay

---

## Executive Summary

Currently, the session replay page shows only metadata (score, date, duration) because **conversation history is not persisted**. LangGraph stores thread state in its own checkpoint system (`.langraph_api/` in dev, PostgreSQL in production), but this state is:
1. **Not accessible** from Appwrite queries
2. **Ephemeral** - may be garbage collected
3. **Not designed** for long-term archival

**Solution**: When a lesson completes, extract the complete `state.values.messages` array from LangGraph and persist it as a compressed JSON blob in the Appwrite sessions collection.

---

## CRITICAL DISCOVERY: Message Ordering in LangGraph

**Key Finding**: Tool calls and messages are stored in a **single ordered array**, not separate collections!

### How LangGraph Preserves Order

1. **Single Messages Array**: `state.values.messages` contains ALL messages in chronological order
2. **Tool Calls Embedded**: Tool calls are part of AIMessage objects, not separate entities
3. **Array Index = Order**: Position in array IS the chronological sequence
4. **Auto-Generated IDs**: Each message gets unique UUID from `add_messages` reducer
5. **No Reconstruction Needed**: Just iterate through messages sequentially to replay

### Message Structure Example

```javascript
messages: [
  // 1. AI introduces card
  { id: "uuid1", type: "ai", content: "Let's learn about fractions..." },

  // 2. Tool call presents card (embedded in AIMessage)
  {
    id: "uuid2",
    type: "ai",
    content: "",  // Empty to avoid duplication
    tool_calls: [{
      name: "lesson_card_presentation",
      args: { card_index: 0, card: {...}, timestamp: "..." }
    }]
  },

  // 3. Student answers
  { id: "uuid3", type: "human", content: "Your Answer: 0.5" },

  // 4. AI gives feedback
  { id: "uuid4", type: "ai", content: "Correct! Great job..." },

  // ... continues in perfect chronological order
]
```

**This dramatically simplifies our persistence plan!**

---

## Current State Analysis

### What Gets Persisted Today ✅

**In Sessions Collection:**
- `session_id`, `student_id`, `course_id`, `lesson_template_id`
- `status` ('completed'), `score`, `startedAt`, `endedAt`
- `lessonSnapshot` (JSON string of lesson template)
- `threadId` (LangGraph thread identifier)

**In Evidence Collection:**
- Individual student responses per card
- Correctness, attempts, confidence, reasoning, feedback
- Links to session via `sessionId`

**In Mastery Collections:**
- Aggregated performance scores by outcome
- EMA calculations
- Updated per lesson completion

### What's MISSING ❌

**Conversation History:**
- Student messages (HumanMessage)
- AI responses (AIMessage)
- Tool calls (lesson card presentations, feedback)
- Tool results (student submissions)
- Timestamps for each interaction
- Complete interaction flow

**Why It Matters:**
- Session replay can't show "what actually happened"
- Can't debug student confusion or AI mistakes
- Can't analyze conversation patterns
- Can't provide detailed performance review

---

## Architecture Design

### 1. Data Structure

#### ConversationHistory Schema (REVISED)

```typescript
interface ConversationHistory {
  version: string; // Schema version for future migrations (e.g., "1.0")
  threadId: string; // LangGraph thread ID
  sessionId: string; // Appwrite session ID
  capturedAt: string; // ISO timestamp when history was captured
  messages: SerializedMessage[]; // Single ordered array - matches LangGraph structure!
}

interface SerializedMessage {
  id: string; // Unique message ID (from LangGraph add_messages reducer)
  type: 'human' | 'ai' | 'system'; // Message type
  content: string; // Message text (may be empty for tool-only messages)
  tool_calls?: ToolCall[]; // Tool calls embedded in message (only for AIMessage)
}

interface ToolCall {
  id: string; // Tool call ID
  name: string; // Tool name (e.g., "lesson_card_presentation", "lesson_completion_summary")
  args: Record<string, any>; // Complete tool arguments including:
    // For lesson_card_presentation:
    //   - card: full card data (question, options, answer)
    //   - card_index: position in lesson
    //   - timestamp: ISO timestamp
    //   - student_answer: what student submitted (if applicable)
    //   - feedback: AI feedback text
    //   - is_correct: boolean correctness
    // For lesson_completion_summary:
    //   - evidence: array of evidence entries
    //   - performance_analysis: scores and metrics
    //   - mastery_updates: EMA updates per outcome
    //   - timestamp: ISO timestamp
}
```

#### Estimated Size Analysis

**Typical Lesson Session:**
- 6 lesson cards × 3 attempts average = ~18 interactions
- Each interaction: 1 AI message (~200 chars) + 1 human message (~50 chars) = 250 chars
- Each tool call: ~1KB JSON (card data + args)
- Total raw: ~18KB per session

**Compression:**
- JSON → gzip compression ratio: ~70-80% reduction
- Compressed size: ~4-5KB per session
- **Safe for Appwrite string field** (max 1MB, we'll use 50KB limit)

### 2. Database Schema Changes

#### Add to Sessions Collection

**New Field via Appwrite MCP:**

```typescript
mcp__appwrite__databases_create_string_attribute({
  database_id: 'default',
  collection_id: 'sessions',
  key: 'conversationHistory',
  size: 50000, // 50KB limit (compressed JSON fits easily)
  required: false, // Optional - old sessions won't have it
  array: false,
  encrypt: false // No sensitive data, just lesson content
})
```

**Rationale:**
- String field with 50KB limit allows ~10x typical session size
- Optional field maintains backwards compatibility
- Not encrypted - lesson content is not PII
- Single field simplifies querying and updates

#### Alternative: Separate Collection (Not Recommended)

We could create a `conversation_history` collection with 1:1 relationship to sessions, but:
- ❌ Requires two queries to fetch history
- ❌ More complex data model
- ❌ Harder to ensure data consistency
- ✅ Would allow unlimited size (if we ever need it)

**Decision**: Use single field in sessions collection for simplicity. Can migrate later if needed.

---

## Implementation Plan

### Phase 1: Extract Conversation History from LangGraph State

**Location**: `langgraph-agent/src/agent/teacher_graph_toolcall_interrupt.py`

**In `generate_summary_node()` - BEFORE creating tool call:**

```python
def _extract_conversation_history(state: InterruptUnifiedState) -> dict:
    """Extract and format conversation history from state."""

    messages = state.get("messages", [])

    conversation_messages = []
    tool_calls = []

    first_timestamp = None
    last_timestamp = None

    for msg in messages:
        timestamp = getattr(msg, 'timestamp', None) or datetime.now().isoformat()

        if first_timestamp is None:
            first_timestamp = timestamp
        last_timestamp = timestamp

        if isinstance(msg, HumanMessage):
            conversation_messages.append({
                "id": getattr(msg, 'id', str(uuid.uuid4())),
                "type": "human",
                "content": msg.content,
                "timestamp": timestamp
            })

        elif isinstance(msg, AIMessage):
            conversation_messages.append({
                "id": getattr(msg, 'id', str(uuid.uuid4())),
                "type": "ai",
                "content": msg.content,
                "timestamp": timestamp
            })

            # Extract tool calls from AI messages
            if hasattr(msg, 'tool_calls') and msg.tool_calls:
                for tool_call in msg.tool_calls:
                    tool_calls.append({
                        "id": tool_call.get('id', str(uuid.uuid4())),
                        "name": tool_call.get('name', ''),
                        "timestamp": timestamp,
                        "args": tool_call.get('args', {}),
                    })

    # Calculate conversation duration
    duration_ms = 0
    if first_timestamp and last_timestamp:
        try:
            start = datetime.fromisoformat(first_timestamp.replace('Z', '+00:00'))
            end = datetime.fromisoformat(last_timestamp.replace('Z', '+00:00'))
            duration_ms = int((end - start).total_seconds() * 1000)
        except Exception:
            pass

    return {
        "version": "1.0",
        "threadId": state.get("threadId", ""),
        "sessionId": state.get("session_id", ""),
        "capturedAt": datetime.now().isoformat(),
        "messages": conversation_messages,
        "toolCalls": tool_calls,
        "metadata": {
            "totalMessages": len(conversation_messages),
            "totalToolCalls": len(tool_calls),
            "conversationDurationMs": duration_ms
        }
    }
```

**Update `generate_summary_node()` tool call args:**

```python
# Add conversation history extraction
conversation_history = _extract_conversation_history(state)

tool_call = ToolCall(
    id="lesson_completion",
    name="lesson_completion_summary",
    args={
        # ... existing args ...
        "conversation_history": conversation_history,  # NEW
        "session_id": state.get("session_id"),
        "student_id": state.get("student_id"),
        "course_id": state.get("course_id")
    }
)
```

### Phase 2: Compress and Persist in Frontend

**Location**: `assistant-ui-frontend/components/tools/LessonCompletionSummaryTool.tsx`

**Add compression utility:**

```typescript
// Add to top of file
import pako from 'pako'; // Install: npm install pako @types/pako

/**
 * Compress conversation history to gzip-compressed base64 string
 */
function compressHistory(history: any): string {
  try {
    // Convert to JSON string
    const jsonString = JSON.stringify(history);

    // Compress with gzip
    const compressed = pako.gzip(jsonString);

    // Convert to base64 for string storage
    const base64 = btoa(String.fromCharCode(...compressed));

    console.log('[Compression] Original size:', jsonString.length, 'bytes');
    console.log('[Compression] Compressed size:', base64.length, 'bytes');
    console.log('[Compression] Ratio:', (base64.length / jsonString.length * 100).toFixed(1), '%');

    return base64;
  } catch (error) {
    console.error('[Compression] Failed to compress history:', error);
    throw new Error('Failed to compress conversation history');
  }
}
```

**Update persistence logic:**

```typescript
// In persistData() function, AFTER session completion:

// 5. Persist conversation history
if (conversation_history) {
  console.log('💬 Compressing and persisting conversation history...');

  try {
    const compressedHistory = compressHistory(conversation_history);

    // Validate size
    if (compressedHistory.length > 50000) {
      console.error('[History] Compressed history too large:', compressedHistory.length, 'bytes');
      throw new Error('Conversation history exceeds 50KB limit');
    }

    await sessionDriver.updateSession(session_id, {
      conversationHistory: compressedHistory
    });

    console.log('✅ Conversation history persisted successfully');
  } catch (error) {
    console.error('❌ Failed to persist conversation history:', error);
    // Non-fatal: session is still marked complete, history is optional
  }
}
```

### Phase 3: Decompress and Retrieve in SessionDriver

**Location**: `assistant-ui-frontend/lib/appwrite/driver/SessionDriver.ts`

**Add decompression utility:**

```typescript
import pako from 'pako';

/**
 * Decompress gzip-compressed base64 conversation history
 */
private decompressHistory(compressed: string): any {
  try {
    // Decode base64 to binary
    const binaryString = atob(compressed);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decompress gzip
    const decompressed = pako.ungzip(bytes, { to: 'string' });

    // Parse JSON
    return JSON.parse(decompressed);
  } catch (error) {
    console.error('[Decompression] Failed to decompress history:', error);
    throw new Error('Failed to decompress conversation history');
  }
}

/**
 * Get session with decompressed conversation history
 */
async getSessionWithHistory(sessionId: string): Promise<Session & { history?: ConversationHistory }> {
  try {
    const session = await this.getById<Session>('sessions', sessionId);

    // Decompress history if present
    if (session.conversationHistory) {
      const history = this.decompressHistory(session.conversationHistory);
      return {
        ...session,
        history
      };
    }

    return session;
  } catch (error) {
    throw this.handleError(error, 'get session with history');
  }
}
```

### Phase 4: Display in Session Replay UI

**Location**: `assistant-ui-frontend/app/sessions/[sessionId]/view/page.tsx`

**Update to fetch and display history:**

```typescript
// Replace placeholder with actual history
useEffect(() => {
  async function loadSession() {
    try {
      // ... existing auth code ...

      // Use new method to get history
      const sessionDriver = new SessionDriver(databases);
      const sessionWithHistory = await sessionDriver.getSessionWithHistory(sessionId);

      setSession(sessionWithHistory);
      setLoading(false);
    } catch (err) {
      // ... error handling ...
    }
  }

  loadSession();
}, [sessionId]);

// Render conversation timeline
{session?.history && (
  <Card className="mt-6">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        Conversation History
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        {session.history.messages.map((msg, index) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 p-4 rounded-lg",
              msg.type === 'human'
                ? "bg-blue-50 border-l-4 border-blue-500"
                : "bg-gray-50 border-l-4 border-gray-300"
            )}
          >
            <div className="flex-shrink-0">
              {msg.type === 'human' ? (
                <User className="h-5 w-5 text-blue-600" />
              ) : (
                <Bot className="h-5 w-5 text-gray-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">
                  {msg.type === 'human' ? 'Student' : 'AI Teacher'}
                </span>
                <time className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(msg.timestamp), {
                    addSuffix: true
                  })}
                </time>
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tool Calls Timeline */}
      {session.history.toolCalls.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <h4 className="text-sm font-medium mb-3">Lesson Cards Presented</h4>
          <div className="space-y-2">
            {session.history.toolCalls
              .filter(tc => tc.name === 'lesson_card_presentation')
              .map((toolCall, index) => (
                <div key={toolCall.id} className="text-sm p-3 bg-purple-50 rounded border-l-4 border-purple-400">
                  <div className="font-medium">
                    Card {index + 1}: {toolCall.args.card?.title || 'Untitled'}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Presented {formatDistanceToNow(new Date(toolCall.timestamp), { addSuffix: true })}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </CardContent>
  </Card>
)}
```

---

## Testing Strategy

### Unit Tests

**Test compression/decompression:**

```typescript
describe('Conversation History Compression', () => {
  it('should compress and decompress correctly', () => {
    const original = {
      version: "1.0",
      messages: [/* ... */],
      toolCalls: [/* ... */]
    };

    const compressed = compressHistory(original);
    const decompressed = decompressHistory(compressed);

    expect(decompressed).toEqual(original);
  });

  it('should reduce size significantly', () => {
    const largeHistory = generateLargeHistory(20); // 20 interactions
    const original = JSON.stringify(largeHistory);
    const compressed = compressHistory(largeHistory);

    const ratio = compressed.length / original.length;
    expect(ratio).toBeLessThan(0.5); // At least 50% reduction
  });

  it('should reject oversized history', () => {
    const tooLarge = generateLargeHistory(1000); // Unrealistically large
    expect(() => compressHistory(tooLarge)).toThrow('exceeds 50KB limit');
  });
});
```

### Integration Tests

**Test end-to-end persistence:**

```typescript
describe('Session History Persistence', () => {
  it('should persist history when lesson completes', async () => {
    // Complete a lesson session
    const { sessionId } = await completeLessonSession({
      studentId: TEST_STUDENT,
      lessonTemplateId: TEST_LESSON
    });

    // Fetch session
    const session = await sessionDriver.getSessionWithHistory(sessionId);

    // Verify history exists
    expect(session.history).toBeDefined();
    expect(session.history.messages.length).toBeGreaterThan(0);
    expect(session.history.toolCalls.length).toBeGreaterThan(0);
  });

  it('should display history in replay UI', async () => {
    // Render session replay page
    render(<SessionReplayPage sessionId={completedSessionId} />);

    // Wait for history to load
    await waitFor(() => {
      expect(screen.getByText('Conversation History')).toBeInTheDocument();
    });

    // Verify messages displayed
    expect(screen.getAllByText(/Student|AI Teacher/)).toHaveLength(session.history.messages.length);
  });
});
```

---

## Migration Strategy

### Backwards Compatibility

**Old sessions without history:**
- Field is optional - old sessions query normally
- UI shows "Conversation history not available" message
- No migration needed - field populated on next lesson completion

**Gradual rollout:**
1. Deploy database schema change (add optional field)
2. Deploy backend changes (start capturing history)
3. Deploy frontend changes (start displaying history)
4. Old sessions continue working without history

### Future Enhancements

**If 50KB limit is insufficient:**
1. Create separate `conversation_history` collection
2. Store as binary blob in Appwrite Storage
3. Link via URL field in sessions
4. Stream decompression for large files

**Schema versioning:**
- `version: "1.0"` allows future format changes
- Can add fields without breaking old readers
- Can migrate data format if needed

---

## Performance Considerations

### Compression Performance

**Client-side:**
- Compression: ~5-10ms for typical session
- Decompression: ~2-5ms
- Negligible impact on UX

**Storage:**
- Typical: 4-5KB compressed vs 18KB raw
- Savings: 70-80% reduction
- Database storage costs reduced proportionally

### Query Performance

**Impact on session queries:**
- Adding 50KB field adds ~5KB overhead per document
- Indexed queries (by studentId, status) unaffected
- Can exclude field from list queries: `Query.select(['$id', 'status', 'score'])`

**Optimization:**
```typescript
// When listing sessions, exclude large field
const sessions = await databases.listDocuments(
  'default',
  'sessions',
  [
    Query.equal('studentId', studentId),
    Query.select(['$id', 'status', 'score', 'startedAt', 'endedAt'])
    // conversationHistory excluded - only fetch when viewing replay
  ]
);
```

---

## Security Considerations

### Data Privacy

**What's stored:**
- Student responses (already stored in evidence collection)
- AI-generated feedback (not PII)
- Lesson content (public curriculum data)
- **No PII beyond what's already in sessions**

**Encryption:**
- Field not encrypted (not sensitive data)
- Transport encryption via HTTPS
- Database encryption at rest (Appwrite default)

### Access Control

**Security rules:**
- Sessions collection already has `documentSecurity: true`
- Students can only query their own sessions
- History inherits session security
- No additional access control needed

---

## Rollout Checklist

### Phase 1: Database Schema
- [ ] Add `conversationHistory` field to sessions collection via Appwrite MCP
- [ ] Verify field appears in collection attributes
- [ ] Test field can store 50KB strings

### Phase 2: Backend Changes
- [ ] Implement `_extract_conversation_history()` in teacher_graph
- [ ] Add history to `lesson_completion_summary` tool call args
- [ ] Test history extraction with real lesson completion

### Phase 3: Frontend Persistence
- [ ] Install `pako` compression library
- [ ] Implement `compressHistory()` utility
- [ ] Update `LessonCompletionSummaryTool` to persist compressed history
- [ ] Test compression ratio and size limits

### Phase 4: Frontend Decompression
- [ ] Implement `decompressHistory()` in SessionDriver
- [ ] Add `getSessionWithHistory()` method
- [ ] Test decompression with real data

### Phase 5: UI Display
- [ ] Update session replay page to fetch history
- [ ] Implement conversation timeline UI
- [ ] Add tool calls timeline UI
- [ ] Test with multiple sessions

### Phase 6: Testing & Documentation
- [ ] Write unit tests for compression/decompression
- [ ] Write integration tests for persistence
- [ ] Update API documentation
- [ ] Update user documentation

---

## Success Criteria

✅ **Functional:**
- Completed lessons have conversation history stored
- Session replay page displays full conversation
- Tool calls timeline shows lesson card presentations
- Old sessions without history continue working

✅ **Performance:**
- Compression reduces size by >50%
- Compressed size stays under 50KB for typical lessons
- UI loads history in <1 second
- No noticeable performance degradation

✅ **Quality:**
- All tests pass
- No data loss during compression/decompression
- Error handling for edge cases (oversized, corrupt data)
- Clean separation of concerns (backend extracts, frontend persists)

---

## Appendix: Alternative Approaches Considered

### A. Store in Separate Collection ❌
**Pros:** Unlimited size, cleaner schema
**Cons:** Two queries needed, more complex, harder to ensure consistency
**Decision:** Single field simpler for MVP, can migrate later

### B. Store Raw JSON ❌
**Pros:** No compression complexity
**Cons:** 3-4x larger storage, hits field size limits sooner
**Decision:** Compression essential for staying under limits

### C. Store in Appwrite Storage (Bucket) ❌
**Pros:** No size limits, supports large files
**Cons:** Separate API calls, more complex, harder to query
**Decision:** Overkill for MVP, consider for v2 if needed

### D. Don't Store, Query LangGraph Directly ❌
**Pros:** No duplication, always up-to-date
**Cons:** LangGraph state may be deleted, requires API access, slower
**Decision:** Persistence required for archival and fast retrieval

---

## Next Steps

1. **Review this plan** - Validate approach with team
2. **Add database field** - Use Appwrite MCP to create `conversationHistory` field
3. **Implement backend extraction** - Update `teacher_graph_toolcall_interrupt.py`
4. **Implement frontend persistence** - Update `LessonCompletionSummaryTool.tsx`
5. **Implement replay UI** - Update session view page
6. **Test end-to-end** - Complete lesson and view replay
7. **Deploy gradually** - Schema → Backend → Frontend
