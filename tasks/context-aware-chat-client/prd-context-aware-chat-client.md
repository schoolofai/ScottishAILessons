# Product Requirements Document: Context-Aware Chat Client

## Reference Documentation

**📋 Implementation Details**: For comprehensive technical architecture, complete backend code implementations, and detailed integration testing strategy, refer to the design brief: [`MVP1-Chat_client.md`](./MVP1-Chat_client.md)

The design brief contains:
- Complete backend implementation code for all modules (state.py, prompts.py, tools.py, context.py, utils.py, graph.py)
- Comprehensive integration testing strategy with LangGraph SDK
- Detailed data flow diagrams and API specifications
- Full frontend component implementations with code examples
- Deployment and rollout strategies

## 1. Introduction/Overview

The Context-Aware Chat Client is a supplementary chat interface that provides students with contextual assistance during their learning sessions. This feature adds a collapsible secondary chat panel alongside the main teaching interface, enabling students to ask questions about their current lesson without disrupting the primary teaching flow. The chat client has real-time access to the teaching session state and provides contextual responses enriched with lesson details, student progress, and recent exchanges.

**Problem Statement**: Students currently cannot ask clarifying questions without interrupting the main teaching flow, leading to learning disruption and context loss. Additionally, the original implementation relied on stale graph state during interrupts, providing outdated context when students need help most.

**Goal**: Enable seamless, context-aware assistance during lessons through a non-disruptive secondary chat interface with deterministic, real-time context extraction.

## 2. Goals

1. **Reduce Learning Disruption**: Enable students to ask questions without interrupting the main teaching flow
2. **Provide Contextual Assistance**: Deliver responses enriched with current lesson state, progress, and recent exchanges
3. **Maintain Chat History**: Persist conversations across sessions for continuity
4. **Ensure Real-time Context**: Always provide assistance based on the most current lesson state using deterministic dual-source context
5. **Handle Interrupt States**: Provide accurate context even when main teaching graph is interrupted
6. **Enable Additional Resources**: Allow students to search for supplementary learning materials
7. **Deliver Graceful Experience**: Provide streaming responses with appropriate error handling

## 3. User Stories

### Primary User Stories
- **As a student**, I want to ask questions about my current lesson without disrupting the teaching flow, so that I can get immediate clarification while maintaining my learning progress
- **As a student**, I want the assistant to understand what lesson I'm currently working on, so that I receive relevant and contextual responses
- **As a student**, I want to search for additional examples related to my current topic, so that I can deepen my understanding
- **As a student**, I want to access my previous chat conversations from past lessons, so that I can review explanations and continue learning
- **As a student**, I want to hide/show the chat panel as needed, so that I can focus on the main lesson when desired

### Secondary User Stories
- **As a student**, I want to receive streaming responses in real-time, so that I know the system is working and don't wait unnecessarily
- **As a student**, I want clear error messages when the system is unavailable, so that I understand when to try again

## 4. Functional Requirements

### Core Chat Functionality
1. **The system must display a collapsible chat panel on the right side of the SessionChatAssistant interface**
2. **The system must allow students to toggle the visibility of the context chat panel**
3. **The system must provide real-time streaming responses following the same pattern as SessionChatAssistant.tsx**
4. **The system must maintain separate conversation threads for context chat and main teaching**

### Context Awareness (Revised for Interrupt Handling)
5. **The system must use dual-source context extraction instead of relying on main graph state**
6. **The system must extract static context from initial session data (immutable lesson information)**
7. **The system must extract dynamic context from LessonCardPresentationTool (current card being presented)**
8. **The system must combine static and dynamic context to provide accurate, real-time lesson awareness**
9. **The system must provide accurate context even when main teaching graph is interrupted**
10. **The system must format context-aware prompts that reference current lesson content and active card**
11. **The system must provide responses that demonstrate understanding of the current learning state**

### Chat History & Persistence
12. **The system must add a 'contextChatThreadId' field to the session data model**
13. **The system must create and store the context chat thread ID when first context message is sent**
14. **The system must load previous context chat conversations when returning to a session**
15. **The system must persist chat history through the LangGraph platform thread system**

### Search Integration
16. **The system must integrate with Tavily search tool for finding additional resources**
17. **The system must enhance search queries with lesson context (topic, current concepts)**
18. **The system must stream search results as part of the conversational response**

### Backend Architecture (Updated for Dual-Source Context)
19. **The system must run the context chat agent on a separate port (2700) from main teaching (2024)**
20. **The system must implement the enhanced react_agent graph with dual-source context processing nodes**
21. **The system must process static context from session data and dynamic context from current card**
22. **The system must use environment variables for LLM model and API key configuration**

### Frontend Context Integration
23. **The system must implement CurrentCardContext React Context provider**
24. **The system must update CurrentCardContext when LessonCardPresentationTool renders**
25. **The system must read from both static session data and CurrentCardContext in ContextChatPanel**

### Error Handling (Enhanced for Interrupt States)
26. **The system must never provide fallback generic responses when context extraction fails**
27. **The system must log detailed error information for debugging purposes**
28. **The system must display friendly error messages to users when services are unavailable**
29. **The system must handle cases where no card is currently being presented gracefully**
30. **The system must inform users to "try later, we're looking into it" during service outages**

## 5. Non-Goals (Out of Scope)

- **Teacher Visibility**: No teacher dashboard or analytics for viewing student chat conversations
- **Rate Limiting**: No message rate limits or token usage tracking for MVP
- **Multi-language Support**: English only for MVP
- **Voice Interaction**: Text-based chat only
- **Advanced Analytics**: No learning analytics or progress tracking dashboards
- **Peer-to-peer Chat**: No student-to-student communication features
- **Mobile Optimization**: Focus on desktop experience for MVP
- **Cost Management**: No usage tracking or billing features
- **Multi-LLM Support**: Single LLM provider configuration only

## 6. Design Considerations

### UI/UX Requirements
- **Two-panel layout**: Main teaching interface (2/3 width) and context chat panel (1/3 width)
- **Collapsible panel**: Toggle button to show/hide context chat
- **Visual separation**: Clear border between main teaching and context chat areas
- **Responsive design**: Context chat should adapt to different screen sizes
- **Loading states**: Show typing indicators and streaming response animations
- **Error states**: Display friendly error messages with retry options

### Component Structure
```
SessionChatAssistant.tsx (Modified)
├── Main Teaching Panel (2/3)
│   └── MyAssistant.tsx (Existing)
└── Context Chat Panel (1/3)
    └── ContextChatPanel.tsx (New)
        ├── Chat Header ("Learning Assistant")
        ├── Assistant-UI Thread Component
        └── Collapse/Expand Controls
```

## 7. Technical Considerations

### Dependencies
- **Frontend**: Assistant-UI React components, LangGraph SDK
- **Backend**: Enhanced langgraph-generic-chat with context processing
- **Search**: Tavily API integration (already available)
- **State Management**: React hooks and LangGraph thread state

### Integration Points
- **Main Teaching Graph**: Extract state via getMainGraphState() method
- **Session Database**: Store contextChatThreadId field
- **LangGraph Platform**: Handle thread persistence and message history
- **Environment Configuration**: Pick up LLM model and API keys from .env

### Performance Requirements
- **Response Time**: Context-aware responses within 2-3 seconds
- **State Extraction**: getMainGraphState() should complete within 500ms
- **Streaming**: Messages should start streaming within 1 second
- **Context Size**: Limit to last 10 messages and essential state fields to manage token usage

## 8. Success Metrics

### User Engagement Metrics
- **Context Chat Usage**: 60%+ of active sessions use the context chat feature
- **Messages per Session**: Average of 3-5 context chat messages per lesson
- **Session Completion**: Maintain or improve current lesson completion rates

### Technical Performance Metrics
- **Response Time**: 95% of context-aware responses delivered within 3 seconds
- **Error Rate**: Less than 2% of context chat interactions result in errors
- **Context Accuracy**: Manual validation shows 90%+ of responses reference current lesson correctly
- **Uptime**: 99.5% availability for context chat service

### User Experience Metrics
- **Feature Adoption**: 40%+ of students use context chat within first week
- **Return Usage**: 70%+ of students who try context chat use it again in subsequent sessions
- **Support Tickets**: No increase in confusion-related support tickets after launch

## 9. Testing Requirements

### Outside-in TDD Approach
1. **End-to-End Happy Path Test**:
   - **Initial State**: Test must FAIL when implementation starts
   - **Success State**: Test must PASS when feature is complete
   - **Test Scenario**: Student starts lesson → Opens context chat → Asks question about current lesson → Receives contextual response → Response references lesson content

2. **Backend Integration Tests**:
   - **Isolation Testing**: Use LangGraph SDK against `langgraph dev --port 2700`
   - **Contract Validation**: Test exact frontend input format
   - **Context Accuracy**: Validate agent understands lesson state
   - **Search Integration**: Verify contextual search functionality

3. **Frontend Component Tests**:
   - **Panel Visibility**: Test collapsible behavior
   - **State Extraction**: Test getMainGraphState() method
   - **Thread Management**: Test context chat thread creation and loading
   - **Error Handling**: Test service unavailable scenarios

### Test Coverage Requirements
- **Backend**: Minimum 90% coverage for context processing logic
- **Frontend**: 85% coverage for new ContextChatPanel component
- **Integration**: 100% coverage for critical user journeys
- **Error Scenarios**: Test all identified error conditions

### Testing Stack
- **Backend**: pytest, asyncio, LangGraph SDK
- **Frontend**: Jest, React Testing Library, @testing-library/user-event
- **E2E**: Playwright (following existing patterns)
- **API Testing**: LangGraph SDK for backend service validation

## 10. Implementation Plan

### Phase 1: Backend Foundation (Week 1)
1. **Enhance langgraph-generic-chat**: Implement context-aware state processing
2. **Create Integration Tests**: Set up isolated backend testing with LangGraph SDK
3. **Test Context Processing**: Validate teaching state extraction and prompt generation

### Phase 2: Frontend Components (Week 2)
4. **Create ContextChatPanel**: Build collapsible chat interface component
5. **Modify SessionChatAssistant**: Add dual-panel layout and state extraction
6. **Implement Thread Management**: Add contextChatThreadId to session handling
7. **Add Component Tests**: Test panel behavior and state management

### Phase 3: Integration & Testing (Week 3)
8. **Backend-Frontend Integration**: Connect context chat to enhanced backend
9. **End-to-End Testing**: Implement and validate happy path test scenario
10. **Error Handling**: Add graceful error states and user messaging
11. **Performance Testing**: Validate response times and streaming behavior

### Phase 4: Validation & Polish (Week 4)
12. **User Testing**: Validate user experience with internal team
13. **Performance Optimization**: Address any performance bottlenecks
14. **Documentation**: Update technical documentation and user guides
15. **Deployment Preparation**: Prepare for production rollout

## 11. Acceptance Criteria

### Core Functionality
- ✅ Context chat panel appears as collapsible sidebar (1/3 width) in SessionChatAssistant
- ✅ Students can toggle panel visibility without affecting main teaching flow
- ✅ Context chat creates and maintains separate thread from main teaching
- ✅ Responses stream in real-time following existing patterns

### Context Awareness
- ✅ Agent demonstrates understanding of current lesson (references specific content)
- ✅ Agent adapts responses based on student's current progress level
- ✅ Agent can search for additional resources related to current topic
- ✅ State extraction happens on every message with current lesson data

### Persistence & History
- ✅ contextChatThreadId is saved to session when first context message sent
- ✅ Previous context chat conversations load when returning to session
- ✅ Chat history persists across browser sessions for same student

### Error Handling
- ✅ System never shows generic fallback responses
- ✅ Detailed errors logged for debugging (not shown to user)
- ✅ User sees friendly "Please try later, we're looking into it" messages
- ✅ System gracefully handles main teaching graph unavailable scenarios

### Testing
- ✅ End-to-end test fails initially and passes after full implementation
- ✅ Backend integration tests validate context awareness in isolation
- ✅ Test coverage meets minimum requirements (90% backend, 85% frontend)
- ✅ All error scenarios have corresponding test cases

## 12. Open Questions

1. **Performance Optimization**: Should we implement any caching for frequently requested context information?
2. **Context Size Limits**: What's the maximum context size before we need to truncate for performance?
3. **Search Result Display**: How should search results be formatted within the chat response?
4. **Mobile Experience**: When should we consider mobile responsive design for the context chat?
5. **Session Timeout**: How should context chat behave when main teaching session expires?

---

**Document Version**: 1.0
**Last Updated**: Initial Creation
**Target Audience**: Junior Developer
**Implementation Timeline**: 4 weeks
**Priority**: High (MVP Feature)