"use client";

import React, { useState, useEffect } from 'react';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Button } from '@/components/ui/button';

// Multi-image vision API limits (same as LessonCardPresentationTool)
const IMAGE_LIMITS = {
  MAX_IMAGES: 5,
  MAX_TOTAL_SIZE_MB: 3,
  MAX_INDIVIDUAL_SIZE_KB: 800,
  WARN_TOTAL_SIZE_MB: 2,
} as const;

/**
 * Isolated test page for RichTextEditor + DrawingModal
 *
 * Purpose: Debug cursor offset issue AND test multi-image validation
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
 * 11. **Add 6+ images and watch for validation warnings**
 */
export default function TestLessonCardPage() {
  const [editorContent, setEditorContent] = useState<string>('');
  const [imageValidation, setImageValidation] = useState<{
    imageCount: number;
    totalSizeMB: number;
    validationErrors: string[];
    validationWarnings: string[];
  }>({ imageCount: 0, totalSizeMB: 0, validationErrors: [], validationWarnings: [] });

  const mockQuestionStem = `# Test Question

Draw a diagram to represent the Pythagorean theorem.

**Requirements:**
- Show a right-angled triangle
- Label the sides as a, b, and c
- Include the formula: a² + b² = c²`;

  // Real-time image validation
  useEffect(() => {
    const imgRegex = /<img[^>]*src="data:image\/png;base64,([A-Za-z0-9+/=]+)"[^>]*>/g;
    const matches = Array.from(editorContent.matchAll(imgRegex));

    if (matches.length === 0) {
      setImageValidation({ imageCount: 0, totalSizeMB: 0, validationErrors: [], validationWarnings: [] });
      return;
    }

    const validationErrors: string[] = [];
    const validationWarnings: string[] = [];
    let totalSizeBytes = 0;

    // Validate each image
    for (let i = 0; i < matches.length; i++) {
      const base64 = matches[i][1];
      const sizeBytes = Math.ceil(base64.length * 0.75);
      const sizeKB = sizeBytes / 1024;
      totalSizeBytes += sizeBytes;

      if (sizeKB > IMAGE_LIMITS.MAX_INDIVIDUAL_SIZE_KB) {
        validationErrors.push(`Image ${i + 1} is too large (${Math.round(sizeKB)}KB). Max: ${IMAGE_LIMITS.MAX_INDIVIDUAL_SIZE_KB}KB`);
      }
    }

    // Validate count
    if (matches.length > IMAGE_LIMITS.MAX_IMAGES) {
      validationErrors.push(`Too many images (${matches.length}). Maximum allowed: ${IMAGE_LIMITS.MAX_IMAGES}`);
    }

    // Validate total size
    const totalSizeMB = totalSizeBytes / (1024 * 1024);
    if (totalSizeMB > IMAGE_LIMITS.MAX_TOTAL_SIZE_MB) {
      validationErrors.push(`Total size too large (${totalSizeMB.toFixed(2)}MB). Max: ${IMAGE_LIMITS.MAX_TOTAL_SIZE_MB}MB`);
    } else if (totalSizeMB > IMAGE_LIMITS.WARN_TOTAL_SIZE_MB) {
      validationWarnings.push(`Approaching size limit (${totalSizeMB.toFixed(2)}MB / ${IMAGE_LIMITS.MAX_TOTAL_SIZE_MB}MB)`);
    }

    setImageValidation({
      imageCount: matches.length,
      totalSizeMB,
      validationErrors,
      validationWarnings
    });
  }, [editorContent]);

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
            🔧 Debug Info & Image Validation
          </h2>
          <div className="space-y-3 text-sm">
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

            {/* Real-time Image Validation Status */}
            {imageValidation.imageCount > 0 && (
              <div className="border-t pt-3 mt-3">
                <div className="font-semibold text-blue-900 mb-2">📎 Image Validation (Real-time)</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${
                      imageValidation.imageCount > IMAGE_LIMITS.MAX_IMAGES ? 'text-red-600' :
                      imageValidation.imageCount === IMAGE_LIMITS.MAX_IMAGES ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {imageValidation.imageCount} image(s)
                    </span>
                    <span className="text-gray-500">/ {IMAGE_LIMITS.MAX_IMAGES} max</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${
                      imageValidation.totalSizeMB > IMAGE_LIMITS.MAX_TOTAL_SIZE_MB ? 'text-red-600' :
                      imageValidation.totalSizeMB > IMAGE_LIMITS.WARN_TOTAL_SIZE_MB ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {imageValidation.totalSizeMB.toFixed(2)}MB
                    </span>
                    <span className="text-gray-500">/ {IMAGE_LIMITS.MAX_TOTAL_SIZE_MB}MB max</span>
                  </div>

                  {/* Validation Errors */}
                  {imageValidation.validationErrors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded p-2 mt-2">
                      <div className="font-semibold text-red-900 text-xs mb-1">❌ Validation Errors:</div>
                      <ul className="text-xs text-red-800 space-y-1 list-disc list-inside">
                        {imageValidation.validationErrors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                      <div className="text-xs text-red-700 mt-2 font-medium">
                        ⚠️ Submission will be blocked until errors are fixed
                      </div>
                    </div>
                  )}

                  {/* Validation Warnings */}
                  {imageValidation.validationWarnings.length > 0 && imageValidation.validationErrors.length === 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                      <div className="font-semibold text-yellow-900 text-xs mb-1">⚠️ Warnings:</div>
                      <ul className="text-xs text-yellow-800 space-y-1 list-disc list-inside">
                        {imageValidation.validationWarnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Success State */}
                  {imageValidation.validationErrors.length === 0 && imageValidation.validationWarnings.length === 0 && (
                    <div className="text-xs text-green-600 font-medium">
                      ✅ All images within limits
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border-t pt-3">
              <span className="font-semibold">Test URL:</span>{' '}
              <span className="text-gray-600 font-mono text-xs">
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
