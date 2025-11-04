"use client";

import React, { useState } from 'react';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Button } from '@/components/ui/button';

/**
 * Isolated test page for RichTextEditor + DrawingModal
 *
 * Purpose: Debug cursor offset issue in drawing canvas
 * Usage: Navigate to http://localhost:3000/test-lesson-card
 *
 * Test Steps:
 * 1. Type some text
 * 2. Click Draw button (✏️)
 * 3. Draw a simple shape (circle + arrow)
 * 4. Click "Insert Drawing"
 * 5. Verify drawing appears in editor
 * 6. Click the drawing to edit it
 * 7. **Check cursor accuracy** - is it accurate?
 * 8. **Reload page (Cmd+R / Ctrl+R)**
 * 9. Click the drawing again
 * 10. **Check cursor accuracy after reload** - this is where the issue appears!
 */
export default function TestLessonCardPage() {
  const [editorContent, setEditorContent] = useState<string>('');

  const mockQuestionStem = `# Test Question

Draw a diagram to represent the Pythagorean theorem.

**Requirements:**
- Show a right-angled triangle
- Label the sides as a, b, and c
- Include the formula: a² + b² = c²`;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 Drawing Canvas Test Page
          </h1>
          <p className="text-gray-600 mb-4">
            Isolated test environment for debugging cursor offset issues
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h2 className="text-sm font-semibold text-yellow-900 mb-2">🐛 Testing Instructions</h2>
            <ol className="text-sm text-yellow-800 space-y-1 list-decimal list-inside">
              <li>Type some text in the editor below</li>
              <li>Click the <strong>Draw button (✏️)</strong></li>
              <li>Draw a simple shape (e.g., circle + arrow)</li>
              <li>Click <strong>"Insert Drawing"</strong></li>
              <li>Verify drawing appears correctly</li>
              <li><strong>Click the drawing</strong> to edit it</li>
              <li>Check if cursor is accurate (draw new shape - does it appear where cursor is?)</li>
              <li><strong>Reload page (Cmd+R)</strong></li>
              <li><strong>Click the drawing again</strong></li>
              <li>Check cursor accuracy after reload - <strong>THIS IS WHERE BUG APPEARS!</strong></li>
            </ol>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h2 className="text-sm font-semibold text-blue-900 mb-2">📋 Mock Question Context</h2>
            <div className="prose prose-sm max-w-none text-blue-800">
              <pre className="text-xs bg-white p-2 rounded border border-blue-200 whitespace-pre-wrap">
                {mockQuestionStem}
              </pre>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Your Answer
          </h2>

          <RichTextEditor
            value={editorContent}
            onChange={setEditorContent}
            placeholder="Type your answer here. Use the Draw button (✏️) to insert diagrams."
            stem={mockQuestionStem}
          />

          <div className="mt-4 flex gap-3">
            <Button
              onClick={() => {
                console.log('📄 Current editor content:');
                console.log(editorContent);
                alert('Check console for editor content');
              }}
              variant="outline"
            >
              📄 Log Content
            </Button>

            <Button
              onClick={() => {
                setEditorContent('');
              }}
              variant="outline"
            >
              🗑️ Clear All
            </Button>

            <Button
              onClick={() => {
                // Extract diagrams from content
                const diagramMatches = editorContent.match(/<img[^>]*data-scene="[^"]*"[^>]*>/g);
                if (diagramMatches) {
                  console.log(`Found ${diagramMatches.length} diagram(s) with scene data`);
                  diagramMatches.forEach((match, idx) => {
                    const sceneMatch = match.match(/data-scene="([^"]*)"/);
                    if (sceneMatch) {
                      try {
                        const sceneData = JSON.parse(sceneMatch[1]);
                        console.log(`Diagram ${idx + 1}:`, {
                          elements: sceneData.elements?.length || 0,
                          hasAppState: !!sceneData.appState,
                          hasFiles: !!sceneData.files
                        });
                      } catch (e) {
                        console.error(`Failed to parse diagram ${idx + 1}`);
                      }
                    }
                  });
                } else {
                  console.log('No diagrams with scene data found');
                }
              }}
              variant="outline"
            >
              🔍 Check Diagrams
            </Button>
          </div>

          {editorContent && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Raw HTML Output (for debugging)
              </h3>
              <pre className="text-xs bg-gray-50 p-3 rounded border overflow-x-auto max-h-60">
                {editorContent}
              </pre>
            </div>
          )}
        </div>

        <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            🔧 Debug Info
          </h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-semibold">Editor Content Length:</span>{' '}
              <span className="text-gray-600">{editorContent.length} characters</span>
            </div>
            <div>
              <span className="font-semibold">Has Diagrams:</span>{' '}
              <span className="text-gray-600">
                {editorContent.includes('data-scene') ? '✅ Yes' : '❌ No'}
              </span>
            </div>
            <div>
              <span className="font-semibold">Test URL:</span>{' '}
              <span className="text-gray-600 font-mono">
                http://localhost:3000/test-lesson-card
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>💡 Open browser console (F12) to see detailed debugging logs</p>
          <p className="mt-1">Look for logs like: 🎨 🖱️ 🎯 📥 ✅ ⚠️</p>
        </div>
      </div>
    </div>
  );
}
