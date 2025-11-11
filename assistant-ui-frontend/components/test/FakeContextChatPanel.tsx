"use client";

/**
 * Fake ContextChatPanel Component for Testing
 *
 * Simulates the context-aware help panel without connecting to backend.
 */

import { useState } from 'react';
import { SessionContext } from '../MyAssistant';

interface FakeContextChatPanelProps {
  sessionId: string;
  sessionContext?: SessionContext;
  existingContextThreadId?: string;
  onThreadCreated?: (threadId: string) => void;
  onCollapseChange?: (collapsed: boolean) => void;
}

export function FakeContextChatPanel({
  sessionId,
  sessionContext,
  existingContextThreadId,
  onThreadCreated,
  onCollapseChange,
}: FakeContextChatPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Hi! I\'m your AI tutor. Ask me anything about the lesson!',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');

  // Simulate thread creation
  useState(() => {
    if (!existingContextThreadId && onThreadCreated) {
      const fakeThreadId = `fake-context-thread-${Date.now()}`;
      console.log('🎭 [FAKE] Creating context thread:', fakeThreadId);
      setTimeout(() => onThreadCreated(fakeThreadId), 300);
    }
  });

  const handleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapseChange?.(newCollapsed);
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Simulate context-aware response
    setTimeout(() => {
      const assistantMessage = {
        role: 'assistant',
        content: generateContextResponse(input, sessionContext),
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    }, 800);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 border-l" data-testid="fake-context-chat-panel">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-blue-50 flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-800 flex items-center gap-2">
            <span>🤖</span>
            <span>AI Tutor</span>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
              FAKE MODE
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Context: {sessionContext?.lesson_snapshot?.title || 'Loading...'}
          </div>
        </div>
        <button
          onClick={handleCollapse}
          className="text-gray-500 hover:text-gray-700 transition-colors"
          data-testid="context-chat-collapse-btn"
        >
          {isCollapsed ? '◀' : '▶'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-purple-500 text-white'
                      : 'bg-white text-gray-900 shadow-sm'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  <div
                    className={`text-xs mt-1 ${
                      msg.role === 'user' ? 'text-purple-100' : 'text-gray-400'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask a question..."
                className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleSend}
                className="px-4 py-2 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Generate context-aware fake response
 */
function generateContextResponse(userInput: string, sessionContext?: SessionContext): string {
  const lowerInput = userInput.toLowerCase();

  if (lowerInput.includes('fraction')) {
    return "Fractions represent parts of a whole. The top number (numerator) shows how many parts you have, and the bottom number (denominator) shows how many parts make up the whole.\n\nFor example, in 2/10:\n- 2 is the numerator (you have 2 parts)\n- 10 is the denominator (the whole is divided into 10 parts)";
  }

  if (lowerInput.includes('equivalent')) {
    return "Equivalent fractions are different fractions that represent the same value!\n\n**Example:**\n- 2/10 = 1/5 = 0.2\n\n**How to find them:**\nMultiply or divide both the numerator and denominator by the same number.\n\n2/10 ÷ 2 = 1/5 ✓";
  }

  if (lowerInput.includes('decimal') || lowerInput.includes('convert')) {
    return "**Converting fractions to decimals:**\n\n1. Divide the top number by the bottom number\n2. For 2/10: do 2 ÷ 10 = 0.2\n\n**Pro tip:** Fractions with 10, 100, or 1000 in the denominator are easy to convert - just count the zeros!";
  }

  if (lowerInput.includes('help') || lowerInput.includes('stuck') || lowerInput.includes('confused')) {
    return "No worries! Let me help. 😊\n\n**What are you working on right now?**\n\n1. Understanding equivalent fractions?\n2. Converting fractions to decimals?\n3. Something else?\n\nJust tell me where you're stuck and I'll explain it in a simpler way!";
  }

  if (lowerInput.includes('example')) {
    return "**Real-world example of 2/10:**\n\n🍕 Imagine a pizza cut into 10 slices.\n- If you eat 2 slices, you've eaten 2/10 of the pizza\n- That's the same as 1/5 of the pizza\n- Or 20% of the pizza\n- Or 0.2 of the pizza\n\nAll these are different ways of saying the same thing!";
  }

  // Default response with lesson context
  const lessonTitle = sessionContext?.lesson_snapshot?.title || 'this lesson';
  return `Great question! In ${lessonTitle}, we're focusing on understanding how different fractions can represent the same value.\n\n**Your question:** "${userInput}"\n\n**My answer:** In the main chat, you're working through practice problems. Here in the tutor chat, I can help explain concepts, give hints, or provide extra examples.\n\nWhat would be most helpful for you right now?`;
}
