"use client";

import React, { useState, useImperativeHandle, forwardRef } from "react";
import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";

// Dynamic import to avoid SSR issues with browser-only APIs
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">Loading drawing canvas...</p>
      </div>
    )
  }
);

// Export function must be imported separately
let exportToBlob: any = null;
if (typeof window !== "undefined") {
  import("@excalidraw/excalidraw").then((module) => {
    exportToBlob = module.exportToBlob;
  });
}

/**
 * Ref interface exposed to parent components
 */
export interface ExcalidrawCanvasRef {
  /**
   * Export the current canvas as a base64-encoded PNG string
   * @returns Promise resolving to base64 string (without data URI prefix)
   * @throws Error if canvas is not ready or export fails
   */
  exportToPngBase64: () => Promise<string>;

  /**
   * Check if the canvas is empty (no elements drawn)
   * @returns true if canvas has no elements, false otherwise
   */
  isEmpty: () => boolean;

  /**
   * Get the current scene elements for debugging
   * @returns Array of Excalidraw elements
   */
  getSceneElements: () => any[];
}

/**
 * Props for ExcalidrawCanvas component
 */
interface ExcalidrawCanvasProps {
  /**
   * Initial elements to pre-populate the canvas (e.g., coordinate axes)
   * Default: empty array (blank canvas)
   */
  initialElements?: any[];

  /**
   * Canvas height in pixels
   * Default: 400px
   */
  height?: number;

  /**
   * Enable grid snapping for precise element placement
   * Default: true
   */
  gridMode?: boolean;

  /**
   * Canvas width - uses full container width if not specified
   * Default: undefined (full width)
   */
  width?: string;
}

/**
 * Coordinate Graph Library Template
 * Pre-defined Cartesian coordinate system with X and Y axes
 */
const coordinateGraphLibraryItem = {
  id: "coordinate-graph",
  status: "published",
  elements: [
    // X-axis (horizontal arrow)
    {
      type: "arrow",
      version: 1,
      versionNonce: 1,
      isDeleted: false,
      id: "x-axis",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      angle: 0,
      x: -200,
      y: 0,
      strokeColor: "#1971c2",
      backgroundColor: "transparent",
      width: 400,
      height: 0,
      seed: 1,
      groupIds: ["coordinate-axes"],
      frameId: null,
      roundness: null,
      boundElements: [],
      updated: Date.now(),
      link: null,
      locked: false,
      startBinding: null,
      endBinding: null,
      lastCommittedPoint: null,
      startArrowhead: null,
      endArrowhead: "arrow",
      points: [[0, 0], [400, 0]]
    },
    // Y-axis (vertical arrow)
    {
      type: "arrow",
      version: 1,
      versionNonce: 2,
      isDeleted: false,
      id: "y-axis",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      angle: 0,
      x: 0,
      y: -200,
      strokeColor: "#1971c2",
      backgroundColor: "transparent",
      width: 0,
      height: 400,
      seed: 2,
      groupIds: ["coordinate-axes"],
      frameId: null,
      roundness: null,
      boundElements: [],
      updated: Date.now(),
      link: null,
      locked: false,
      startBinding: null,
      endBinding: null,
      lastCommittedPoint: null,
      startArrowhead: null,
      endArrowhead: "arrow",
      points: [[0, 0], [0, 400]]
    },
    // X-axis label
    {
      type: "text",
      version: 1,
      versionNonce: 3,
      isDeleted: false,
      id: "x-label",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      angle: 0,
      x: 210,
      y: -15,
      strokeColor: "#1971c2",
      backgroundColor: "transparent",
      width: 20,
      height: 25,
      seed: 3,
      groupIds: ["coordinate-axes"],
      frameId: null,
      roundness: null,
      boundElements: [],
      updated: Date.now(),
      link: null,
      locked: false,
      fontSize: 20,
      fontFamily: 1,
      text: "x",
      textAlign: "left",
      verticalAlign: "top",
      containerId: null,
      originalText: "x",
      lineHeight: 1.25
    },
    // Y-axis label
    {
      type: "text",
      version: 1,
      versionNonce: 4,
      isDeleted: false,
      id: "y-label",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      angle: 0,
      x: 10,
      y: -220,
      strokeColor: "#1971c2",
      backgroundColor: "transparent",
      width: 20,
      height: 25,
      seed: 4,
      groupIds: ["coordinate-axes"],
      frameId: null,
      roundness: null,
      boundElements: [],
      updated: Date.now(),
      link: null,
      locked: false,
      fontSize: 20,
      fontFamily: 1,
      text: "y",
      textAlign: "left",
      verticalAlign: "top",
      containerId: null,
      originalText: "y",
      lineHeight: 1.25
    }
  ]
};

/**
 * Excalidraw Canvas Component
 *
 * A reusable drawing canvas wrapper for Excalidraw with export functionality.
 * Designed for student diagram submissions in lesson cards.
 *
 * Features:
 * - SSR-safe (Next.js compatible)
 * - Export to base64 PNG for backend submission
 * - Empty canvas validation
 * - Template support (pre-populated elements)
 * - Grid snapping and visibility for precision
 * - Pre-loaded library with coordinate graph template
 *
 * @example
 * ```tsx
 * const canvasRef = useRef<ExcalidrawCanvasRef>(null);
 *
 * const handleSubmit = async () => {
 *   if (canvasRef.current?.isEmpty()) {
 *     alert("Please draw something first");
 *     return;
 *   }
 *   const base64 = await canvasRef.current?.exportToPngBase64();
 *   // Send base64 to backend
 * };
 *
 * <ExcalidrawCanvas
 *   ref={canvasRef}
 *   initialElements={cartesianAxisTemplate}
 *   height={500}
 *   gridMode={true}
 * />
 * ```
 */
export const ExcalidrawCanvas = forwardRef<ExcalidrawCanvasRef, ExcalidrawCanvasProps>(
  ({ initialElements = [], height = 400, gridMode = true, width = "100%" }, ref) => {
    const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      exportToPngBase64: async (): Promise<string> => {
        if (!excalidrawAPI) {
          throw new Error("Canvas not ready. Please wait for the canvas to load.");
        }

        if (!exportToBlob) {
          throw new Error("Export function not loaded. Please try again.");
        }

        try {
          console.log('🎨 Exporting canvas to PNG...');

          const elements = excalidrawAPI.getSceneElements();
          const appState = excalidrawAPI.getAppState();
          const files = excalidrawAPI.getFiles();

          console.log(`📊 Canvas elements: ${elements.length} items`);

          const blob = await exportToBlob({
            elements,
            appState,
            files,
            mimeType: "image/png",
          });

          console.log(`📦 Blob created: ${blob.size} bytes`);

          return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onloadend = () => {
              if (typeof reader.result === "string") {
                // Remove "data:image/png;base64," prefix for backend
                const base64 = reader.result.replace(/^data:.+;base64,/, '');
                console.log(`✅ Base64 export complete: ${base64.length} characters`);
                resolve(base64);
              } else {
                reject(new Error("Failed to convert blob to base64"));
              }
            };

            reader.onerror = () => {
              console.error('❌ FileReader error:', reader.error);
              reject(reader.error);
            };

            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error('❌ Export to PNG failed:', error);
          throw error;
        }
      },

      isEmpty: (): boolean => {
        if (!excalidrawAPI) {
          console.warn('⚠️ Canvas API not ready, assuming empty');
          return true;
        }

        const elements = excalidrawAPI.getSceneElements();
        const nonDeletedElements = elements.filter((el: any) => !el.isDeleted);

        console.log(`🔍 Canvas check: ${nonDeletedElements.length} elements (${elements.length} total)`);
        return nonDeletedElements.length === 0;
      },

      getSceneElements: (): any[] => {
        if (!excalidrawAPI) {
          console.warn('⚠️ Canvas API not ready');
          return [];
        }
        return excalidrawAPI.getSceneElements();
      }
    }));

    return (
      <div
        style={{
          height: `${height}px`,
          width,
        }}
      >
        <Excalidraw
          excalidrawAPI={(api) => {
            console.log('🎨 Excalidraw API initialized');
            setExcalidrawAPI(api);

            // Add coordinate graph template to library after API is ready
            if (api && api.updateLibrary) {
              setTimeout(() => {
                api.updateLibrary({
                  libraryItems: [coordinateGraphLibraryItem]
                }).then(() => {
                  console.log('📚 Coordinate graph template added to library');
                }).catch((err: any) => {
                  console.warn('⚠️ Failed to add library template:', err);
                });
              }, 500);
            }
          }}
          initialData={{
            elements: initialElements,
            appState: {
              gridSize: gridMode ? 20 : null,
              gridColor: gridMode ? { Bold: '#e0e0e0', Regular: '#f0f0f0' } : undefined,
              viewBackgroundColor: "#ffffff",
              currentItemStrokeColor: "#000000",
              currentItemBackgroundColor: "transparent",
              currentItemFillStyle: "solid",
              currentItemStrokeWidth: 2,
              currentItemRoughness: 0,
              currentItemOpacity: 100,
            },
            scrollToContent: false,
          }}
          gridModeEnabled={gridMode}
        />
      </div>
    );
  }
);

ExcalidrawCanvas.displayName = "ExcalidrawCanvas";
