# LangGraph Integration Refactor TODO

## Phase 1: Simplify Thread Management ✅
- [x] Remove manual thread caching (`threadCache` Map)
- [x] Eliminate `threadIdRef` and `runtimeThreadId` complexity  
- [x] Let `useLangGraphRuntime` handle thread lifecycle naturally
- [x] Update MyAssistant.tsx to use standard runtime patterns
- [x] Refactor AutoStartTrigger to use proper runtime hooks (`useThreadRuntime` + `useThread`)

## Phase 2: Thread Persistence Implementation 🚧
- [x] **Phase 1**: Add Thread Persistence to Database Schema
  - [x] Update Session interface with threadId and lastMessageAt fields
  - [x] Add SessionDriver methods for thread ID persistence
- [x] **Phase 2**: Fix Thread-Session Association  
  - [x] Update MyAssistant.tsx to accept existingThreadId prop
  - [x] Update SessionChatAssistant.tsx to pass thread ID from session
  - [x] Implement thread ID saving on creation
- [x] **Phase 3**: Implement Thread Continuity Logic
  - [x] Enhance chatApi.ts with session update calls
  - [x] Update stream function to save thread IDs and timestamps
- [x] **Phase 4**: Testing & Validation - ✅ **FULLY COMPLETED**
  - [x] Test new lesson creation with thread ID persistence - ✅ **SUCCESS**
  - [x] Test lesson resume with thread ID loading - ✅ **SUCCESS**  
  - [x] **CRITICAL**: Add threadId and lastMessageAt attributes to Appwrite database - ✅ **COMPLETED**
  - [x] **FIXED**: Thread history loading - implemented manual `runtime.switchToThread()` call - ✅ **SUCCESS**
  - [x] Validate complete conversation continuity works end-to-end - ✅ **SUCCESS** (4 messages loaded perfectly)

## Phase 3: Proper Runtime Usage (Deferred)
- [ ] Remove custom stream override in `useLangGraphRuntime`
- [ ] Implement autostart through runtime hooks instead of `AutoStartTrigger`
- [ ] Use assistant-ui's built-in message management
- [ ] Simplify chatApi.ts to use standard patterns

## Phase 3: Architecture Improvements
- [ ] Move session context into runtime state instead of prop drilling
- [ ] Add proper TypeScript types for LangGraph integration  
- [ ] Implement error boundaries and retry logic
- [ ] Clean up component architecture

## Phase 4: Testing & Validation
- [ ] Test thread continuity with simplified approach
- [ ] Verify autostart functionality works with new runtime approach
- [ ] Ensure all existing lesson flow functionality preserved
- [ ] Run full integration test with Playwright

## Current Status
✅ Phase 1 Complete - Thread Management Simplified & AutoStartTrigger Refactored
✅ **Testing Confirmed**: Autostart works perfectly with refactored runtime hooks

## Anti-Patterns Identified
- ❌ Manual thread management instead of runtime-managed
- ❌ Multiple sources of truth for thread IDs
- ❌ Custom stream function bypassing framework optimizations
- ❌ Side-effect component for runtime functionality
- ❌ Prop drilling instead of runtime state usage