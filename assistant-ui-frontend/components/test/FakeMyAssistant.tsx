"use client";

/**
 * Fake MyAssistant Component for Testing
 *
 * Simulates the main teaching interface without connecting to LangGraph backend.
 * Shows realistic UI with fake messages and interactions.
 */

import { useState } from 'react';
import { SessionContext } from '../MyAssistant';

interface FakeMyAssistantProps {
  sessionId: string;
  threadId?: string;
  sessionContext?: SessionContext;
  onThreadCreated?: (threadId: string) => void;
}

export function FakeMyAssistant({
  sessionId,
  threadId,
  sessionContext,
  onThreadCreated,
}: FakeMyAssistantProps) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Welcome to your lesson on **Understanding Equivalent Fractions**!\n\nToday we\'ll explore how different fractions can represent the same value. Ready to get started?',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');

  // Simulate thread creation on mount
  useState(() => {
    if (!threadId && onThreadCreated) {
      const fakeThreadId = `fake-thread-${Date.now()}`;
      console.log('🎭 [FAKE] Creating thread:', fakeThreadId);
      setTimeout(() => onThreadCreated(fakeThreadId), 500);
    }
  });

  const handleSend = () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Simulate assistant response
    setTimeout(() => {
      const assistantMessage = {
        role: 'assistant',
        content: generateFakeResponse(input),
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full bg-white" data-testid="fake-my-assistant">
      {/* Header */}
      <div className="p-4 border-b bg-blue-50">
        <div className="text-sm text-gray-600">
          🎭 <strong>FAKE MODE</strong> - Session: {sessionId}
        </div>
        <div className="text-sm text-gray-500">
          Thread: {threadId || 'Creating...'}
        </div>
        {sessionContext && (
          <div className="text-xs text-gray-500 mt-1">
            Lesson: {sessionContext.lesson_snapshot?.title}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              <div
                className={`text-xs mt-1 ${
                  msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSend()}
            placeholder="Type your response..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Generate a fake assistant response based on user input
 */
function generateFakeResponse(userInput: string): string {
  const lowerInput = userInput.toLowerCase();

  if (lowerInput.includes('yes') || lowerInput.includes('ready') || lowerInput.includes('start')) {
    return "Great! Let's begin.\n\n**Card 1: Introduction to Equivalent Fractions**\n\nEquivalent fractions represent the same value but are written differently. For example, 2/10 and 1/5 are equivalent because they both equal 0.2.\n\n**Question:** Which fraction is equivalent to 2/10?\n\nA) 1/5 ✓\nB) 2/5\nC) 1/10\nD) 2/20";
  }

  if (lowerInput.includes('1/5') || lowerInput.includes('a')) {
    return "🎉 **Correct!** Well done!\n\nYes, 1/5 is equivalent to 2/10. Both fractions equal 0.2 or 20%.\n\n**Why?** When we simplify 2/10 by dividing both the numerator and denominator by 2, we get 1/5.\n\nReady to move to the next card?";
  }

  if (lowerInput.includes('help') || lowerInput.includes('hint')) {
    return "💡 **Hint:** Try simplifying the fraction 2/10 by finding the greatest common divisor of 2 and 10.\n\nWhat number divides evenly into both 2 and 10?";
  }

  if (lowerInput.includes('next') || lowerInput.includes('continue')) {
    return "**Card 2: Converting Fractions to Decimals**\n\nTo convert a fraction to a decimal, divide the numerator (top number) by the denominator (bottom number).\n\nFor example: 2/10 = 2 ÷ 10 = 0.2\n\n**Question:** Convert 2/10 to a decimal.\n\n_(Enter your answer)_";
  }

  if (lowerInput.includes('0.2') || lowerInput.includes('.2')) {
    return "🎉 **Excellent work!**\n\nYou've correctly converted 2/10 to 0.2.\n\n**Summary:**\n- 2/10 = 1/5 (simplified)\n- 2/10 = 0.2 (decimal)\n- 2/10 = 20% (percentage)\n\nAll three forms represent the same value! You've completed this lesson. Great job! 🌟";
  }

  // Default response
  return `I understand you said: "${userInput}"\n\nIn a real lesson, I would provide tailored feedback based on your response. For now, try answering the question or type "help" for a hint!`;
}
