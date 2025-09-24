/**
 * Unit tests for ContextChatPanel component
 *
 * RED STATE: All tests will initially FAIL as the component doesn't exist yet.
 * GREEN STATE: Tests pass when the component is fully implemented.
 *
 * Test coverage:
 * - Component rendering and visibility
 * - Collapsible behavior
 * - Context state extraction integration
 * - Error handling and user feedback
 * - Session context integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ContextChatPanel } from '../ContextChatPanel';

// Mock the LangGraph runtime hook
jest.mock('@assistant-ui/react-langgraph', () => ({
  useLangGraphRuntime: jest.fn(),
  AssistantRuntimeProvider: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="runtime-provider">{children}</div>,
}));

// Mock the Thread component
jest.mock('../assistant-ui/thread', () => ({
  Thread: () => <div data-testid="thread-component" />,
}));

describe('ContextChatPanel', () => {
  const mockGetMainGraphState = jest.fn();
  const mockStream = jest.fn();

  const defaultProps = {
    sessionId: 'test-session-123',
    getMainGraphState: mockGetMainGraphState,
    sessionContext: {
      session_id: 'test-session-123',
      student_id: 'student-456',
      lesson_snapshot: {
        title: 'Test Lesson',
        topic: 'Mathematics'
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the LangGraph runtime
    const { useLangGraphRuntime } = require('@assistant-ui/react-langgraph');
    useLangGraphRuntime.mockReturnValue({
      stream: mockStream,
      threadId: 'test-thread-context'
    });

    // Default mock for state extraction
    mockGetMainGraphState.mockResolvedValue({
      messages: [
        { role: 'human', content: 'Test question' },
        { role: 'assistant', content: 'Test response about fractions 2/10' }
      ],
      lesson_snapshot: { title: 'Fraction Basics' },
      current_stage: 'introduction'
    });
  });

  describe('Component Rendering', () => {
    test('renders context chat panel with correct structure', () => {
      // RED: This will fail initially - component doesn't exist
      render(<ContextChatPanel {...defaultProps} />);

      // Should render the main panel
      expect(screen.getByTestId('context-chat-panel')).toBeInTheDocument();

      // Should have the correct CSS classes for layout
      expect(screen.getByTestId('context-chat-panel')).toHaveClass('context-chat-panel');
    });

    test('displays correct header content', () => {
      // RED: This will fail initially
      render(<ContextChatPanel {...defaultProps} />);

      const header = screen.getByTestId('context-chat-header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveTextContent('Learning Assistant');
      expect(header).toHaveTextContent('Ask questions about your lesson');
    });

    test('renders collapse/expand toggle button', () => {
      // RED: This will fail initially
      render(<ContextChatPanel {...defaultProps} />);

      const toggleButton = screen.getByTestId('context-chat-toggle');
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton).toBeVisible();
    });
  });

  describe('Collapsible Behavior', () => {
    test('starts in expanded state by default', () => {
      // RED: This will fail initially
      render(<ContextChatPanel {...defaultProps} />);

      const chatContent = screen.getByTestId('context-chat-content');
      expect(chatContent).toBeVisible();

      const toggleButton = screen.getByTestId('context-chat-toggle');
      expect(toggleButton).toHaveTextContent('◀'); // Collapse arrow
    });

    test('collapses when toggle button is clicked', async () => {
      // RED: This will fail initially
      render(<ContextChatPanel {...defaultProps} />);

      const toggleButton = screen.getByTestId('context-chat-toggle');
      const chatContent = screen.getByTestId('context-chat-content');

      // Initially expanded
      expect(chatContent).toBeVisible();

      // Click to collapse
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(chatContent).not.toBeVisible();
        expect(toggleButton).toHaveTextContent('▶'); // Expand arrow
      });
    });

    test('expands when toggle button is clicked again', async () => {
      // RED: This will fail initially
      render(<ContextChatPanel {...defaultProps} />);

      const toggleButton = screen.getByTestId('context-chat-toggle');
      const chatContent = screen.getByTestId('context-chat-content');

      // Collapse first
      fireEvent.click(toggleButton);
      await waitFor(() => expect(chatContent).not.toBeVisible());

      // Then expand
      fireEvent.click(toggleButton);
      await waitFor(() => {
        expect(chatContent).toBeVisible();
        expect(toggleButton).toHaveTextContent('◀');
      });
    });

    test('persists collapse state during re-renders', async () => {
      // RED: This will fail initially
      const { rerender } = render(<ContextChatPanel {...defaultProps} />);

      const toggleButton = screen.getByTestId('context-chat-toggle');

      // Collapse the panel
      fireEvent.click(toggleButton);
      await waitFor(() =>
        expect(screen.getByTestId('context-chat-content')).not.toBeVisible()
      );

      // Re-render with new props
      rerender(<ContextChatPanel {...defaultProps} sessionId="new-session" />);

      // Should remain collapsed
      expect(screen.getByTestId('context-chat-content')).not.toBeVisible();
      expect(toggleButton).toHaveTextContent('▶');
    });
  });

  describe('Context State Integration', () => {
    test('calls getMainGraphState when sending message', async () => {
      // RED: This will fail initially
      render(<ContextChatPanel {...defaultProps} />);

      // Mock runtime stream to trigger state extraction
      mockStream.mockImplementation(async (messages) => {
        // Simulate the component calling getMainGraphState
        await mockGetMainGraphState();
        return Promise.resolve();
      });

      // Simulate user sending a message (this would normally be done by Thread component)
      const { useLangGraphRuntime } = require('@assistant-ui/react-langgraph');
      const runtimeConfig = useLangGraphRuntime.mock.calls[0][0];

      // Call the stream function with test messages
      await runtimeConfig.stream([{ content: 'Test message' }]);

      expect(mockGetMainGraphState).toHaveBeenCalledTimes(1);
    });

    test('passes session context and main state to backend', async () => {
      // RED: This will fail initially
      render(<ContextChatPanel {...defaultProps} />);

      const mockMainState = {
        messages: [{ role: 'assistant', content: 'We are discussing 2/10 fractions' }],
        lesson_snapshot: { title: 'Fractions' },
        current_stage: 'examples'
      };

      mockGetMainGraphState.mockResolvedValue(mockMainState);

      mockStream.mockImplementation(async (messages, context) => {
        // Verify the context includes both session and extracted state
        expect(context).toEqual({
          ...defaultProps.sessionContext,
          main_graph_state: mockMainState
        });
        return Promise.resolve();
      });

      // Trigger runtime stream
      const { useLangGraphRuntime } = require('@assistant-ui/react-langgraph');
      const runtimeConfig = useLangGraphRuntime.mock.calls[0][0];

      await runtimeConfig.stream([{ content: 'What fraction are we studying?' }]);

      expect(mockGetMainGraphState).toHaveBeenCalled();
    });

    test('handles state extraction errors gracefully', async () => {
      // RED: This will fail initially
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<ContextChatPanel {...defaultProps} />);

      // Mock state extraction failure
      mockGetMainGraphState.mockRejectedValue(new Error('State extraction failed'));

      // Should not crash the component
      const { useLangGraphRuntime } = require('@assistant-ui/react-langgraph');
      const runtimeConfig = useLangGraphRuntime.mock.calls[0][0];

      await expect(runtimeConfig.stream([{ content: 'Test' }])).resolves.not.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Thread Integration', () => {
    test('renders Assistant-UI Thread component when expanded', () => {
      // RED: This will fail initially
      render(<ContextChatPanel {...defaultProps} />);

      // Should render the runtime provider
      expect(screen.getByTestId('runtime-provider')).toBeInTheDocument();

      // Should render the thread component
      expect(screen.getByTestId('thread-component')).toBeInTheDocument();
    });

    test('does not render thread when collapsed', async () => {
      // RED: This will fail initially
      render(<ContextChatPanel {...defaultProps} />);

      const toggleButton = screen.getByTestId('context-chat-toggle');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        // Thread should be hidden when collapsed
        expect(screen.queryByTestId('thread-component')).not.toBeVisible();
      });
    });

    test('provides correct runtime configuration to Thread', () => {
      // RED: This will fail initially
      render(<ContextChatPanel {...defaultProps} />);

      const { useLangGraphRuntime } = require('@assistant-ui/react-langgraph');
      const runtimeConfig = useLangGraphRuntime.mock.calls[0][0];

      // Should have stream function
      expect(typeof runtimeConfig.stream).toBe('function');

      // Should have threadId
      expect(runtimeConfig.threadId).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('displays error message when context chat service is unavailable', async () => {
      // RED: This will fail initially
      render(<ContextChatPanel {...defaultProps} />);

      // Mock service unavailable
      mockStream.mockRejectedValue(new Error('Context chat service unavailable'));

      const { useLangGraphRuntime } = require('@assistant-ui/react-langgraph');
      const runtimeConfig = useLangGraphRuntime.mock.calls[0][0];

      // Try to stream a message
      await expect(runtimeConfig.stream([{ content: 'Test' }])).rejects.toThrow();

      // Should show user-friendly error (this would be handled by Thread component error boundary)
    });

    test('does not show generic fallback responses on error', () => {
      // RED: This will fail initially
      render(<ContextChatPanel {...defaultProps} />);

      // Component should not render any generic helper text
      expect(screen.queryByText(/I can help you with/)).not.toBeInTheDocument();
      expect(screen.queryByText(/How can I assist/)).not.toBeInTheDocument();
      expect(screen.queryByText(/What would you like to know/)).not.toBeInTheDocument();
    });
  });

  describe('Props Validation', () => {
    test('handles missing sessionContext gracefully', () => {
      // RED: This will fail initially
      const propsWithoutContext = {
        ...defaultProps,
        sessionContext: undefined
      };

      expect(() => render(<ContextChatPanel {...propsWithoutContext} />))
        .not.toThrow();
    });

    test('handles missing getMainGraphState function', async () => {
      // RED: This will fail initially
      const propsWithoutGetter = {
        ...defaultProps,
        getMainGraphState: undefined
      };

      // Should render but handle the missing function gracefully
      expect(() => render(<ContextChatPanel {...propsWithoutGetter} />))
        .not.toThrow();
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels for screen readers', () => {
      // RED: This will fail initially
      render(<ContextChatPanel {...defaultProps} />);

      const panel = screen.getByTestId('context-chat-panel');
      expect(panel).toHaveAttribute('role', 'complementary');
      expect(panel).toHaveAttribute('aria-label', 'Context-aware learning assistant');

      const toggleButton = screen.getByTestId('context-chat-toggle');
      expect(toggleButton).toHaveAttribute('aria-label');
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    });

    test('updates aria-expanded when collapsed/expanded', async () => {
      // RED: This will fail initially
      render(<ContextChatPanel {...defaultProps} />);

      const toggleButton = screen.getByTestId('context-chat-toggle');

      // Initially expanded
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

      // Collapse
      fireEvent.click(toggleButton);
      await waitFor(() => {
        expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
      });
    });

    test('supports keyboard navigation', () => {
      // RED: This will fail initially
      render(<ContextChatPanel {...defaultProps} />);

      const toggleButton = screen.getByTestId('context-chat-toggle');

      // Should be focusable
      toggleButton.focus();
      expect(document.activeElement).toBe(toggleButton);

      // Should respond to Enter key
      fireEvent.keyDown(toggleButton, { key: 'Enter' });
      // Collapse behavior should trigger
    });
  });
});