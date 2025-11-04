"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { DrawingModal } from "@/components/ui/drawing-modal";

export default function TestExcalidrawPage() {
  const [showModal, setShowModal] = useState(false);
  const [insertedImages, setInsertedImages] = useState<string[]>([]);

  const sampleStem = `**Question**: Draw a diagram to solve this problem.\n\nCalculate the area of a rectangle with:\n- Length: 8 cm\n- Width: 5 cm\n\n**Show your working** by drawing the rectangle and labeling the dimensions.`;

  const handleInsert = (base64Image: string) => {
    console.log('✅ Image inserted:', base64Image.substring(0, 50) + '...');
    setInsertedImages([...insertedImages, `data:image/png;base64,${base64Image}`]);
    setShowModal(false);
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">🎨 Excalidraw Canvas Test Page</h1>

        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Test Features:</h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            <li>✅ Excalidraw drawing canvas with toolbar</li>
            <li>✅ Grid mode enabled by default</li>
            <li>✅ Quick Access Panel with 15+ science library items</li>
            <li>✅ External libraries loaded (Math, Circuits, Chemistry, Biology)</li>
            <li>✅ Question stem display on left side</li>
            <li>✅ Element selection, resizing, and editing</li>
            <li>✅ Export to PNG base64</li>
          </ul>
        </div>

        <div className="mb-6 space-y-4">
          <div>
            <h3 className="text-xl font-semibold mb-3">Test Scenarios:</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={() => setShowModal(true)}
                size="lg"
                className="h-auto py-4 flex flex-col items-start"
              >
                <span className="text-lg font-bold mb-1">🎯 Test 1: Basic Drawing</span>
                <span className="text-sm font-normal opacity-90">
                  Open modal with question stem, draw shapes, test selection/resize
                </span>
              </Button>

              <Button
                onClick={() => setShowModal(true)}
                size="lg"
                variant="secondary"
                className="h-auto py-4 flex flex-col items-start"
              >
                <span className="text-lg font-bold mb-1">📚 Test 2: Library Items</span>
                <span className="text-sm font-normal opacity-90">
                  Use Quick Access Panel to insert coordinate graph, circuit components
                </span>
              </Button>

              <Button
                onClick={() => setShowModal(true)}
                size="lg"
                variant="outline"
                className="h-auto py-4 flex flex-col items-start"
              >
                <span className="text-lg font-bold mb-1">✏️ Test 3: Mixed Content</span>
                <span className="text-sm font-normal opacity-90">
                  Combine library items with freehand drawing and text
                </span>
              </Button>

              <Button
                onClick={() => setShowModal(true)}
                size="lg"
                variant="outline"
                className="h-auto py-4 flex flex-col items-start"
              >
                <span className="text-lg font-bold mb-1">🎨 Test 4: Element Interaction</span>
                <span className="text-sm font-normal opacity-90">
                  Test selecting, resizing, moving, and deleting elements
                </span>
              </Button>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold mb-2">🧪 Testing Checklist:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4" />
                <span>Draw basic shapes (rectangle, ellipse, arrow)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4" />
                <span>Insert library item via Quick Access Panel</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4" />
                <span>Select element by clicking</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4" />
                <span>Resize element using corner handles</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4" />
                <span>Move element by dragging</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4" />
                <span>Delete element with Delete/Backspace key</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4" />
                <span>Quick Access Panel doesn't block canvas</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4" />
                <span>Export to PNG works correctly</span>
              </label>
            </div>
          </div>
        </div>

        {/* Drawing Modal */}
        <DrawingModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onInsert={handleInsert}
          stem={sampleStem}
        />

        {/* Inserted Images Gallery */}
        {insertedImages.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">✅ Inserted Drawings ({insertedImages.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {insertedImages.map((image, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border-2 border-green-500 shadow-lg">
                  <div className="mb-2 flex justify-between items-center">
                    <span className="text-sm font-semibold text-green-700">
                      Drawing #{index + 1}
                    </span>
                    <Button
                      onClick={() => {
                        setInsertedImages(insertedImages.filter((_, i) => i !== index));
                      }}
                      variant="destructive"
                      size="sm"
                    >
                      Delete
                    </Button>
                  </div>
                  <div className="border border-gray-300 rounded p-2 bg-gray-50">
                    <img src={image} alt={`Drawing ${index + 1}`} className="w-full" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Size: ~{Math.round(image.length / 1024)}KB
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button
                onClick={() => setInsertedImages([])}
                variant="outline"
                size="lg"
              >
                Clear All Drawings
              </Button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 p-6 bg-white rounded-lg border border-gray-300">
          <h3 className="text-xl font-bold mb-3">📖 How to Test:</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Click any test scenario button above to open the drawing modal</li>
            <li>The modal shows:
              <ul className="list-disc list-inside ml-6 mt-1">
                <li><strong>Left side (30%):</strong> Question/stem with formatted text</li>
                <li><strong>Right side (70%):</strong> Excalidraw canvas with Quick Access Panel</li>
              </ul>
            </li>
            <li>Test canvas interactions:
              <ul className="list-disc list-inside ml-6 mt-1">
                <li>Draw shapes using toolbar buttons or keyboard shortcuts</li>
                <li>Click Quick Access Panel toggle button on right edge</li>
                <li>Insert library items by clicking category tabs and item buttons</li>
                <li>Click elements to select (should show selection handles)</li>
                <li>Drag corner handles to resize</li>
                <li>Drag elements to move them</li>
                <li>Press Delete or Backspace to delete selected elements</li>
              </ul>
            </li>
            <li>Click "Insert Drawing" to export and add to gallery below</li>
            <li>Verify the exported image appears correctly</li>
          </ol>
        </div>

        {/* Debug Info */}
        <div className="mt-8 p-4 bg-gray-800 text-green-400 rounded-lg font-mono text-sm">
          <div className="mb-2 font-bold text-white">🔍 Debug Info:</div>
          <div>Modal Open: {showModal ? 'true' : 'false'}</div>
          <div>Inserted Images: {insertedImages.length}</div>
          <div>Page URL: /test-excalidraw</div>
          <div>Test Page Active: ✅</div>
        </div>
      </div>
    </div>
  );
}
