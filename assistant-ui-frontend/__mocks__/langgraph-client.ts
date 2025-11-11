/**
 * Mock LangGraph Client and Related Functions
 *
 * This file provides mocks for LangGraph SDK and Assistant-UI runtime
 * to enable testing of components that use LangGraph without connecting
 * to a real backend.
 *
 * Usage:
 *   import { mockUseLangGraphRuntime } from '@/__mocks__/langgraph-client';
 *   jest.mock('@assistant-ui/react-langgraph', () => ({
 *     useLangGraphRuntime: mockUseLangGraphRuntime
 *   }));
 */

// ============================================
// LangGraph Client Mock
// ============================================

export interface MockLangGraphClient {
  threads: {
    get: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    getState: jest.Mock;
  };
  runs: {
    stream: jest.Mock;
    create: jest.Mock;
    wait: jest.Mock;
  };
}

/**
 * Create a mock LangGraph Client with default implementations
 */
export function createMockLangGraphClient(overrides?: Partial<MockLangGraphClient>): MockLangGraphClient {
  return {
    threads: {
      get: jest.fn().mockResolvedValue({
        thread_id: 'mock-thread-id',
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-01T10:00:00.000Z',
        metadata: {},
      }),
      create: jest.fn().mockResolvedValue({
        thread_id: 'new-mock-thread-id',
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-01T10:00:00.000Z',
        metadata: {},
      }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      getState: jest.fn().mockResolvedValue({
        values: {},
        next: [],
        config: {},
        created_at: '2025-01-01T10:00:00.000Z',
        parent_config: null,
      }),
    },
    runs: {
      stream: jest.fn().mockImplementation(async function* () {
        yield {
          event: 'messages/partial',
          data: [{ role: 'assistant', content: 'Test response' }],
        };
      }),
      create: jest.fn().mockResolvedValue({
        run_id: 'mock-run-id',
        thread_id: 'mock-thread-id',
        created_at: '2025-01-01T10:00:00.000Z',
        status: 'success',
      }),
      wait: jest.fn().mockResolvedValue({
        run_id: 'mock-run-id',
        thread_id: 'mock-thread-id',
        status: 'success',
      }),
    },
    ...overrides,
  };
}

// ============================================
// useLangGraphRuntime Mock
// ============================================

export interface MockLangGraphRuntime {
  threadId: string;
  stream: jest.Mock;
  append: jest.Mock;
  reload: jest.Mock;
  startRun: jest.Mock;
}

/**
 * Create a mock LangGraph runtime (from @assistant-ui/react-langgraph)
 */
export function createMockLangGraphRuntime(overrides?: Partial<MockLangGraphRuntime>): MockLangGraphRuntime {
  return {
    threadId: 'mock-runtime-thread-id',
    stream: jest.fn().mockResolvedValue(undefined),
    append: jest.fn().mockResolvedValue(undefined),
    reload: jest.fn().mockResolvedValue(undefined),
    startRun: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Mock the useLangGraphRuntime hook
 */
export const mockUseLangGraphRuntime = jest.fn(() => createMockLangGraphRuntime());

// ============================================
// AssistantRuntimeProvider Mock
// ============================================

/**
 * Mock AssistantRuntimeProvider as a simple wrapper component
 */
export const MockAssistantRuntimeProvider = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="runtime-provider">{children}</div>
);

// ============================================
// Thread Component Mock
// ============================================

/**
 * Mock Thread component (from Assistant-UI)
 */
export const MockThread = () => <div data-testid="thread-component">Mock Thread</div>;

// ============================================
// Enrichment Helper Mock
// ============================================

/**
 * Mock the enrichOutcomeRefs helper function
 */
export const mockEnrichOutcomeRefs = jest.fn().mockResolvedValue([]);

// ============================================
// Navigation Hook Mock
// ============================================

/**
 * Mock the usePreventNavigation hook
 */
export const mockUsePreventNavigation = jest.fn();

// ============================================
// Router Mock (Next.js)
// ============================================

export interface MockRouter {
  push: jest.Mock;
  back: jest.Mock;
  forward: jest.Mock;
  replace: jest.Mock;
  refresh: jest.Mock;
  prefetch: jest.Mock;
}

/**
 * Create a mock Next.js router
 */
export function createMockRouter(overrides?: Partial<MockRouter>): MockRouter {
  return {
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
    ...overrides,
  };
}

/**
 * Mock the useRouter hook
 */
export const mockUseRouter = jest.fn(() => createMockRouter());
