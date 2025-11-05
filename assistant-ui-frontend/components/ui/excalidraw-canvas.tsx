"use client";

import React, { useState, useImperativeHandle, forwardRef } from "react";
import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";
import {
  LibraryCategory,
  DEFAULT_LIBRARY_CATEGORIES,
  getLibraryUrls
} from "./excalidraw-libraries-config";

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

// Export functions must be imported separately (client-side only)
let exportToBlob: any = null;
let exportToCanvas: any = null;
let exportToSvg: any = null;
let serializeAsJSON: any = null;

if (typeof window !== "undefined") {
  import("@excalidraw/excalidraw").then((module) => {
    exportToBlob = module.exportToBlob;
    exportToCanvas = module.exportToCanvas;
    exportToSvg = module.exportToSvg;
    serializeAsJSON = module.serializeAsJSON;
    console.log('✅ Excalidraw export functions loaded:', {
      hasExportToBlob: !!module.exportToBlob,
      hasExportToCanvas: !!module.exportToCanvas,
      hasExportToSvg: !!module.exportToSvg,
      hasSerializeAsJSON: !!module.serializeAsJSON
    });
  }).catch((error) => {
    console.error('❌ Failed to load Excalidraw export functions:', error);
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

  /**
   * Insert a library item onto the canvas by its ID
   * @param itemId - The ID of the library item to insert
   */
  insertLibraryItem: (itemId: string) => void;

  /**
   * Export the current scene data (elements, appState, files) for later restoration
   * @returns Scene data object that can be JSON stringified
   * @throws Error if canvas is not ready
   */
  exportSceneData: () => any;

  /**
   * Load scene data to restore a previous drawing
   * @param sceneData - Scene data object (previously exported)
   * @throws Error if canvas is not ready or data is invalid
   */
  loadSceneData: (sceneData: any) => void;

  /**
   * Force Excalidraw to refresh its canvas position and recalculate coordinates
   * Use this after the canvas container has moved or resized
   * Fixes cursor offset issues when modal/container layout shifts
   */
  refreshCanvas: () => void;

  /**
   * Export and download the canvas as a PNG file to disk
   * @param filename - Optional filename (default: "drawing-{timestamp}.png")
   * @returns Promise that resolves when download is triggered
   * @throws Error if canvas is not ready or export fails
   */
  downloadAsPng: (filename?: string) => Promise<void>;

  /**
   * Export and download the scene data as .excalidraw JSON file
   * @param filename - Optional filename (default: "drawing-{timestamp}.excalidraw")
   * @returns Promise that resolves when download is triggered
   * @throws Error if canvas is not ready
   */
  downloadAsExcalidraw: (filename?: string) => Promise<void>;
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

  /**
   * Enable loading of external libraries from libraries.excalidraw.com
   * Default: true
   */
  enableExternalLibraries?: boolean;

  /**
   * Specify which library categories to load
   * Default: all categories ['math', 'circuits', 'chemistry', 'biology']
   */
  libraryCategories?: LibraryCategory[];

  /**
   * Additional custom library URLs to load alongside default libraries
   * Format: Full URL to .excalidrawlib JSON file
   */
  customLibraryUrls?: string[];
}

/**
 * Fetch external library from URL and extract library items
 * @param url - Full URL to .excalidrawlib JSON file
 * @returns Promise resolving to array of library items, or empty array on error
 */
async function fetchExternalLibrary(url: string): Promise<any[]> {
  try {
    console.log(`📚 Fetching library: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Validate excalidrawlib format
    if (data.type !== "excalidrawlib" || !Array.isArray(data.libraryItems)) {
      throw new Error("Invalid .excalidrawlib format");
    }

    console.log(`✅ Loaded library: ${data.libraryItems.length} items`);
    return data.libraryItems;
  } catch (error) {
    console.warn(`⚠️ Failed to load library from ${url}:`, error);
    return []; // Return empty array to allow other libraries to load
  }
}

/**
 * Load multiple libraries in parallel and merge results
 * @param urls - Array of library URLs to fetch
 * @returns Promise resolving to merged array of all library items
 */
async function loadLibraries(urls: string[]): Promise<any[]> {
  console.log(`🔄 Loading ${urls.length} external libraries...`);

  const results = await Promise.allSettled(
    urls.map(url => fetchExternalLibrary(url))
  );

  const allItems = results
    .filter((result): result is PromiseFulfilledResult<any[]> =>
      result.status === 'fulfilled'
    )
    .flatMap(result => result.value);

  const failedCount = results.filter(r => r.status === 'rejected').length;

  console.log(`📊 Library loading complete: ${allItems.length} items loaded (${failedCount} failed)`);

  return allItems;
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
  ({
    initialElements = [],
    height = 400,
    gridMode = true,
    width = "100%",
    enableExternalLibraries = true,
    libraryCategories = DEFAULT_LIBRARY_CATEGORIES,
    customLibraryUrls = []
  }, ref) => {
    const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
    const [loadedLibraryItems, setLoadedLibraryItems] = useState<any[]>([]);

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
      },

      insertLibraryItem: (itemId: string): void => {
        if (!excalidrawAPI) {
          console.warn('⚠️ Canvas API not ready');
          return;
        }

        console.log(`🎯 Inserting library item: ${itemId}`);

        // Find the library item by exact ID first
        let libraryItem = loadedLibraryItems.find(item => item.id === itemId);

        // If not found by ID, try multiple search strategies
        if (!libraryItem) {
          const searchTerm = itemId.toLowerCase().replace(/-/g, ' ').replace(/_/g, ' ');

          // Strategy 1: Exact name match (case-insensitive)
          libraryItem = loadedLibraryItems.find(item =>
            item.name && item.name.toLowerCase() === searchTerm
          );

          // Strategy 2: Partial name match (search term in name)
          if (!libraryItem) {
            libraryItem = loadedLibraryItems.find(item =>
              item.name && item.name.toLowerCase().includes(searchTerm)
            );
          }

          // Strategy 3: Reverse match (name in search term) - for longer library names
          if (!libraryItem) {
            libraryItem = loadedLibraryItems.find(item =>
              item.name && searchTerm.includes(item.name.toLowerCase())
            );
          }

          // Strategy 4: Word-by-word match (any word matches)
          if (!libraryItem) {
            const searchWords = searchTerm.split(' ');
            libraryItem = loadedLibraryItems.find(item => {
              if (!item.name) return false;
              const nameWords = item.name.toLowerCase().split(' ');
              return searchWords.some(searchWord =>
                nameWords.some(nameWord =>
                  nameWord.includes(searchWord) || searchWord.includes(nameWord)
                )
              );
            });
          }

          if (libraryItem) {
            console.log(`✅ Found library item by name match: "${libraryItem.name}" (ID: ${libraryItem.id})`);
          }
        }

        if (!libraryItem) {
          console.warn(`⚠️ Library item not found: "${itemId}"`);
          console.log(`📚 Try one of these available items:`, loadedLibraryItems.slice(0, 10).map(item => ({ id: item.id, name: item.name })));
          alert(`Item "${itemId}" not found. Check browser console to see available items.`);
          return;
        }

        // Get current elements
        const currentElements = excalidrawAPI.getSceneElements();

        // Clone library item elements and position them in center of visible viewport
        const appState = excalidrawAPI.getAppState();
        const { scrollX, scrollY, zoom, width, height } = appState;

        // Calculate the center of the visible canvas viewport in canvas coordinates
        const viewportCenterX = -scrollX / zoom.value + (width / 2) / zoom.value;
        const viewportCenterY = -scrollY / zoom.value + (height / 2) / zoom.value;

        // Calculate bounding box of library item to center it properly
        const itemElements = libraryItem.elements;
        const bounds = itemElements.reduce((acc: any, el: any) => {
          const minX = Math.min(acc.minX, el.x);
          const minY = Math.min(acc.minY, el.y);
          const maxX = Math.max(acc.maxX, el.x + (el.width || 0));
          const maxY = Math.max(acc.maxY, el.y + (el.height || 0));
          return { minX, minY, maxX, maxY };
        }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

        const itemCenterX = (bounds.minX + bounds.maxX) / 2;
        const itemCenterY = (bounds.minY + bounds.maxY) / 2;

        // Calculate offset to move item center to viewport center
        const offsetX = viewportCenterX - itemCenterX;
        const offsetY = viewportCenterY - itemCenterY;

        console.log(`📍 Positioning: viewport center (${Math.round(viewportCenterX)}, ${Math.round(viewportCenterY)}), offset (${Math.round(offsetX)}, ${Math.round(offsetY)})`);

        // Clone with ALL required Excalidraw properties for full selectability
        const newElements = libraryItem.elements.map((el: any) => ({
          ...el,
          // Identity
          id: `${el.id}-${Date.now()}-${Math.random()}`,
          type: el.type, // Explicit type preservation

          // Positioning
          x: el.x + offsetX,
          y: el.y + offsetY,

          // State flags
          isDeleted: false,
          locked: false,

          // Relationship properties - clear all bindings to old elements
          boundElements: null, // Use null instead of [] to match TypeScript definition
          groupIds: [],
          frameId: null, // CRITICAL: Prevent frame inheritance from library items

          // Ordering (CRITICAL - was missing)
          index: null, // Let Excalidraw assign proper fractional index

          // Randomization for rendering
          seed: Math.floor(Math.random() * 2 ** 31),

          // Version tracking
          version: (el.version || 0) + 1,
          versionNonce: Math.floor(Math.random() * 2 ** 31),

          // Timestamp
          updated: Date.now(),

          // Optional data preservation
          customData: el.customData ? { ...el.customData } : undefined,
        }));

        // Add to canvas
        excalidrawAPI.updateScene({
          elements: [...currentElements, ...newElements],
        });

        console.log(`✅ Inserted ${newElements.length} elements from library item "${itemId}"`);
      },

      exportSceneData: (): any => {
        if (!excalidrawAPI) {
          throw new Error("Canvas not ready. Please wait for the canvas to load.");
        }

        try {
          console.log('📦 Exporting scene data for editing...');

          const elements = excalidrawAPI.getSceneElements();
          const appState = excalidrawAPI.getAppState();
          const files = excalidrawAPI.getFiles();

          const sceneData = {
            elements,
            appState: {
              // Preserve essential state for restoration (but NOT viewport state)
              viewBackgroundColor: appState.viewBackgroundColor,
              gridSize: appState.gridSize,
              gridColor: appState.gridColor,
              // Explicitly exclude zoom and scroll offset to prevent cursor issues
              // These will be reset when loading for accurate cursor positioning
            },
            files: files || {},
          };

          console.log(`✅ Scene data exported: ${elements.length} elements`);
          return sceneData;
        } catch (error) {
          console.error('❌ Export scene data failed:', error);
          throw error;
        }
      },

      loadSceneData: (sceneData: any): void => {
        if (!excalidrawAPI) {
          throw new Error("Canvas not ready. Please wait for the canvas to load.");
        }

        if (!sceneData || !sceneData.elements) {
          throw new Error("Invalid scene data provided");
        }

        try {
          console.log('📥 ═══════════════════════════════════════════════════');
          console.log('📥 LOADING SCENE DATA FOR EDITING');
          console.log('📥 ═══════════════════════════════════════════════════');
          console.log(`📊 Restoring ${sceneData.elements.length} elements`);

          // Log element positions for debugging offset issues
          console.log('🎯 ELEMENT POSITIONS (first 3 elements):');
          sceneData.elements.slice(0, 3).forEach((el: any, idx: number) => {
            console.log(`  Element ${idx}: type=${el.type}, x=${el.x}, y=${el.y}, width=${el.width}, height=${el.height}`);
          });

          // Log viewport state BEFORE loading
          const beforeState = excalidrawAPI.getAppState();
          console.log('📊 VIEWPORT BEFORE LOAD:', {
            zoom: beforeState.zoom?.value,
            scrollX: beforeState.scrollX,
            scrollY: beforeState.scrollY,
            width: beforeState.width,
            height: beforeState.height
          });

          // CRITICAL: Match the exact initialization configuration from initialData
          // This ensures cursor accuracy by preventing automatic viewport adjustments
          excalidrawAPI.updateScene({
            elements: sceneData.elements,
            appState: {
              // Preserve visual settings from saved scene (but NOT viewport)
              viewBackgroundColor: sceneData.appState?.viewBackgroundColor,
              gridSize: sceneData.appState?.gridSize,
              gridColor: sceneData.appState?.gridColor,
              // FORCE RESET viewport state to 100% zoom - DO NOT preserve from saved scene
              zoom: { value: 1 },
              scrollX: 0,
              scrollY: 0,
            },
            files: sceneData.files || {},
            // CRITICAL FIX: scrollToContent: false matches initialData configuration
            // This prevents Excalidraw from auto-scrolling which causes cursor offset
            scrollToContent: false,
          });

          // Log viewport state AFTER loading
          const afterState = excalidrawAPI.getAppState();
          console.log('📊 VIEWPORT AFTER LOAD:', {
            zoom: afterState.zoom?.value,
            scrollX: afterState.scrollX,
            scrollY: afterState.scrollY,
            width: afterState.width,
            height: afterState.height
          });

          console.log('✅ Scene loaded with zoom: 1, scrollX: 0, scrollY: 0, scrollToContent: false');

          // Multi-stage viewport reset to combat localStorage pollution
          // Stage 1: Immediate reset (already done above)
          // Stage 2: Delayed reset to override any localStorage restoration
          setTimeout(() => {
            if (!excalidrawAPI) return;

            try {
              // Force viewport reset again to override localStorage
              excalidrawAPI.updateScene({
                appState: {
                  zoom: { value: 1 },
                  scrollX: 0,
                  scrollY: 0,
                },
              });

              const currentState = excalidrawAPI.getAppState();
              console.log(`🔍 Viewport verification: zoom=${currentState.zoom?.value || 'unknown'}, scrollX=${currentState.scrollX}, scrollY=${currentState.scrollY}`);

              // DO NOT call scrollToContent with fitToViewport=true
              // This was causing automatic zoom changes (170%, 360%, etc.)
              // which created cursor offset issues when editing diagrams

              // Instead, just center the viewport without changing zoom
              excalidrawAPI.scrollToContent(sceneData.elements, {
                fitToViewport: false,  // Keep current zoom (100%)
                animate: false,
              });

              const afterScrollState = excalidrawAPI.getAppState();
              console.log('📊 VIEWPORT AFTER SCROLL-TO-CONTENT:', {
                zoom: afterScrollState.zoom?.value,
                scrollX: afterScrollState.scrollX,
                scrollY: afterScrollState.scrollY
              });
              console.log('🎯 Viewport centered at 100% zoom (no auto-fit)');
            } catch (error) {
              console.warn('⚠️ Post-load viewport adjustment failed:', error);
            }
          }, 200);

          // Stage 3: Add ROBUST real-time drawing offset tracking for loaded scene
          // Use multiple attempts with longer delays to ensure Excalidraw is fully ready
          const attemptAttachListeners = (attemptNumber: number) => {
            if (!excalidrawAPI) {
              console.warn('⚠️ Excalidraw API not available, cannot attach listeners');
              return;
            }

            setTimeout(() => {
              // Try multiple selectors to find the canvas
              let canvasElement = document.querySelector('.excalidraw__canvas') as HTMLCanvasElement;

              if (!canvasElement) {
                canvasElement = document.querySelector('canvas.excalidraw') as HTMLCanvasElement;
              }

              if (!canvasElement) {
                const allCanvases = document.querySelectorAll('canvas');
                if (allCanvases.length > 0) {
                  canvasElement = allCanvases[allCanvases.length - 1] as HTMLCanvasElement;
                }
              }

              if (!canvasElement) {
                console.warn(`⚠️ Attempt ${attemptNumber}: Canvas element not found`);
                if (attemptNumber < 5) {
                  attemptAttachListeners(attemptNumber + 1);
                }
                return;
              }

              console.log(`✅ ATTEMPT ${attemptNumber}: Canvas element found:`, {
                className: canvasElement.className,
                width: canvasElement.width,
                height: canvasElement.height
              });

              let isDrawing = false;
              let drawStartTime = 0;
              let eventCount = 0;
              const maxEventLogs = 50; // Log more events to catch the issue

              const logReloadedSceneDrawingOffset = (event: PointerEvent) => {
                if (eventCount >= maxEventLogs) return;

                // Re-get canvas in case it changed
                const canvas = document.querySelector('.excalidraw__canvas') as HTMLCanvasElement;
                if (!canvas) return;

                const rect = canvas.getBoundingClientRect();
                const appState = excalidrawAPI.getAppState();

                // Calculate cursor position relative to canvas
                const cursorCanvasX = event.clientX - rect.left;
                const cursorCanvasY = event.clientY - rect.top;

                // Calculate where Excalidraw will place this point in canvas coordinates
                const excalidrawX = (cursorCanvasX - appState.scrollX) / appState.zoom.value;
                const excalidrawY = (cursorCanvasY - appState.scrollY) / appState.zoom.value;

                // Get current elements to see where drawing actually is
                const elements = excalidrawAPI.getSceneElements();
                const lastElement = elements[elements.length - 1];

                let actualDrawingPos = null;
                if (lastElement && !lastElement.isDeleted) {
                  actualDrawingPos = {
                    x: lastElement.x,
                    y: lastElement.y,
                    width: lastElement.width || 0,
                    height: lastElement.height || 0,
                    type: lastElement.type
                  };
                }

                eventCount++;

                console.log(`🔄 RELOADED SCENE OFFSET #${eventCount} (${event.type}):`, {
                  timestamp: Date.now() - drawStartTime,
                  cursor: {
                    screenX: event.clientX,
                    screenY: event.clientY,
                    canvasRelativeX: Math.round(cursorCanvasX),
                    canvasRelativeY: Math.round(cursorCanvasY)
                  },
                  viewport: {
                    zoom: appState.zoom.value.toFixed(2),
                    scrollX: Math.round(appState.scrollX),
                    scrollY: Math.round(appState.scrollY),
                    canvasWidth: Math.round(rect.width),
                    canvasHeight: Math.round(rect.height)
                  },
                  expectedCanvasCoords: {
                    x: Math.round(excalidrawX),
                    y: Math.round(excalidrawY)
                  },
                  actualElement: actualDrawingPos ? {
                    type: actualDrawingPos.type,
                    x: Math.round(actualDrawingPos.x),
                    y: Math.round(actualDrawingPos.y),
                    endX: Math.round(actualDrawingPos.x + actualDrawingPos.width),
                    endY: Math.round(actualDrawingPos.y + actualDrawingPos.height)
                  } : 'NO_ELEMENT',
                  offset: actualDrawingPos ? {
                  deltaX: Math.round(excalidrawX - actualDrawingPos.x),
                  deltaY: Math.round(excalidrawY - actualDrawingPos.y),
                  magnitude: Math.round(Math.sqrt(
                    Math.pow(excalidrawX - actualDrawingPos.x, 2) +
                    Math.pow(excalidrawY - actualDrawingPos.y, 2)
                  ))
                } : 'N/A'
              });
            };

            // Test that events fire AT ALL
            const testHandlerReload = (event: PointerEvent) => {
              console.log(`🧪 RELOADED TEST EVENT FIRED: ${event.type} at (${event.clientX}, ${event.clientY})`);
            };

            // Track when drawing starts on reloaded scene
            const pointerDownHandlerReload = (event: PointerEvent) => {
              console.log(`👇 RELOADED POINTERDOWN at (${event.clientX}, ${event.clientY})`);
              isDrawing = true;
              drawStartTime = Date.now();
              eventCount = 0;
              console.log('🔄 ═══════════════════════════════════════════════════');
              console.log('🔄 DRAWING ON RELOADED SCENE - Offset tracking enabled');
              console.log('🔄 ═══════════════════════════════════════════════════');
              logReloadedSceneDrawingOffset(event);
            };

            // Track cursor movement while drawing on reloaded scene
            const pointerMoveHandlerReload = (event: PointerEvent) => {
              if (isDrawing) {
                logReloadedSceneDrawingOffset(event);
              }
            };

            // Track when drawing ends on reloaded scene
            const pointerUpHandlerReload = (event: PointerEvent) => {
              console.log(`👆 RELOADED POINTERUP at (${event.clientX}, ${event.clientY})`);
              if (isDrawing) {
                logReloadedSceneDrawingOffset(event);
                console.log('✅ RELOADED SCENE DRAWING ENDED - Total events logged:', eventCount);
                console.log('🔄 ═══════════════════════════════════════════════════');
                isDrawing = false;
              }
            };

              // Add test listener first with capture to fire before Excalidraw
              canvasElement.addEventListener('pointerdown', testHandlerReload, { once: true, capture: true });
              console.log(`🧪 ATTEMPT ${attemptNumber}: Test listener attached with CAPTURE`);

              // Add main listeners with CAPTURE: true to intercept before Excalidraw
              canvasElement.addEventListener('pointerdown', pointerDownHandlerReload, { capture: true });
              canvasElement.addEventListener('pointermove', pointerMoveHandlerReload, { capture: true });
              canvasElement.addEventListener('pointerup', pointerUpHandlerReload, { capture: true });

              console.log(`✅ ATTEMPT ${attemptNumber}: Real-time drawing offset tracking attached with CAPTURE MODE`);
              console.log('🐛 RELOADED - Canvas:', canvasElement.className);
              console.log('🐛 RELOADED - Parent:', canvasElement.parentElement?.className);
            }, attemptNumber * 200); // Increasing delays: 200ms, 400ms, 600ms, etc.
          };

          // Start attempting to attach listeners
          attemptAttachListeners(1);

        } catch (error) {
          console.error('❌ Load scene data failed:', error);
          throw error;
        }
      },

      refreshCanvas: (): void => {
        if (!excalidrawAPI) {
          console.warn('⚠️ Canvas API not ready for refresh');
          return;
        }

        try {
          console.log('🔄 Forcing Excalidraw to refresh canvas position...');
          // Excalidraw's refresh() method recalculates canvas getBoundingClientRect()
          excalidrawAPI.refresh();
          console.log('✅ Canvas position refreshed - cursor coordinates should now be accurate');
        } catch (error) {
          console.error('❌ Canvas refresh failed:', error);
        }
      },

      downloadAsPng: async (filename?: string): Promise<void> => {
        if (!excalidrawAPI) {
          throw new Error("Canvas not ready. Please wait for the canvas to load.");
        }

        if (!exportToBlob) {
          throw new Error("Export function not loaded. Please try again in a moment.");
        }

        try {
          console.log('💾 Downloading canvas as PNG...');

          const elements = excalidrawAPI.getSceneElements();
          const appState = excalidrawAPI.getAppState();
          const files = excalidrawAPI.getFiles();

          // Generate filename with timestamp if not provided
          const finalFilename = filename || `drawing-${Date.now()}.png`;

          console.log(`📊 Exporting ${elements.length} elements to ${finalFilename}`);

          // Export to blob
          const blob = await exportToBlob({
            elements,
            appState,
            files,
            mimeType: "image/png",
          });

          console.log(`📦 PNG blob created: ${blob.size} bytes`);

          // Trigger browser download
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = finalFilename;
          link.style.display = 'none';

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Clean up object URL after a short delay
          setTimeout(() => URL.revokeObjectURL(url), 100);

          console.log(`✅ PNG download triggered: ${finalFilename}`);
        } catch (error) {
          console.error('❌ Failed to download PNG:', error);
          throw error;
        }
      },

      downloadAsExcalidraw: async (filename?: string): Promise<void> => {
        if (!excalidrawAPI) {
          throw new Error("Canvas not ready. Please wait for the canvas to load.");
        }

        if (!serializeAsJSON) {
          throw new Error("Serialize function not loaded. Please try again in a moment.");
        }

        try {
          console.log('💾 Downloading scene as .excalidraw file...');

          const elements = excalidrawAPI.getSceneElements();
          const appState = excalidrawAPI.getAppState();
          const files = excalidrawAPI.getFiles();

          // Generate filename with timestamp if not provided
          const finalFilename = filename || `drawing-${Date.now()}.excalidraw`;

          console.log(`📊 Serializing ${elements.length} elements to ${finalFilename}`);

          // Serialize to JSON
          const serializedData = serializeAsJSON(elements, appState, files, 'local');

          // Create blob from JSON string
          const blob = new Blob([serializedData], { type: 'application/json' });

          console.log(`📦 Excalidraw file created: ${blob.size} bytes`);

          // Trigger browser download
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = finalFilename;
          link.style.display = 'none';

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Clean up object URL after a short delay
          setTimeout(() => URL.revokeObjectURL(url), 100);

          console.log(`✅ Excalidraw file download triggered: ${finalFilename}`);
        } catch (error) {
          console.error('❌ Failed to download Excalidraw file:', error);
          throw error;
        }
      },
    }), [excalidrawAPI, loadedLibraryItems]);

    return (
      <div
        style={{
          height: `${height}px`,
          width,
        }}
        className="excalidraw-wrapper"
      >
        <Excalidraw
          excalidrawAPI={(api) => {
            console.log('🎨 Excalidraw API initialized');

            // Log initial state immediately
            const initialState = api.getAppState();
            console.log('📊 VIEWPORT DEBUG - Initial state from API:', {
              zoom: initialState.zoom?.value || 'unknown',
              scrollX: initialState.scrollX,
              scrollY: initialState.scrollY,
              timestamp: new Date().toISOString()
            });

            setExcalidrawAPI(api);

            // NOTE: Viewport pollution is prevented by:
            // 1. Clearing Excalidraw localStorage on modal open (drawing-modal.tsx)
            // 2. Setting explicit viewport values in initialData below
            // This eliminates the need for updateScene() which causes React setState warnings

            // DEBUG: Add real-time cursor offset tracking while drawing
            const attachCursorDebugListener = () => {
                let attempts = 0;
                const maxAttempts = 20; // 2 seconds max

                const checkInterval = setInterval(() => {
                  attempts++;

                  // Try multiple selectors to find the canvas
                  let canvasElement = document.querySelector('.excalidraw__canvas') as HTMLCanvasElement;

                  if (!canvasElement) {
                    // Try alternative selector
                    canvasElement = document.querySelector('canvas.excalidraw') as HTMLCanvasElement;
                  }

                  if (!canvasElement) {
                    // Try finding ANY canvas in the modal
                    const allCanvases = document.querySelectorAll('canvas');
                    console.log(`🔍 Attempt ${attempts}: Found ${allCanvases.length} canvas elements`);
                    if (allCanvases.length > 0) {
                      canvasElement = allCanvases[allCanvases.length - 1] as HTMLCanvasElement;
                      console.log(`🎯 Using last canvas element:`, canvasElement.className);
                    }
                  }

                  if (canvasElement) {
                    console.log(`✅ Canvas element found on attempt ${attempts}:`, {
                      className: canvasElement.className,
                      width: canvasElement.width,
                      height: canvasElement.height,
                      tagName: canvasElement.tagName
                    });
                    let isDrawing = false;
                    let drawStartTime = 0;
                    let eventCount = 0;
                    const maxEventLogs = 30; // Log first 30 events while drawing

                    const logRealTimeCursorOffset = (event: PointerEvent) => {
                      if (eventCount >= maxEventLogs) return;

                      const rect = canvasElement.getBoundingClientRect();
                      const appState = api.getAppState();

                      // Calculate cursor position relative to canvas
                      const cursorCanvasX = event.clientX - rect.left;
                      const cursorCanvasY = event.clientY - rect.top;

                      // Calculate where Excalidraw will place this point in canvas coordinates
                      // This is the inverse of the viewport transform
                      const excalidrawX = (cursorCanvasX - appState.scrollX) / appState.zoom.value;
                      const excalidrawY = (cursorCanvasY - appState.scrollY) / appState.zoom.value;

                      // Get current elements to see where drawing actually is
                      const elements = api.getSceneElements();
                      const lastElement = elements[elements.length - 1];

                      let actualDrawingPos = null;
                      if (lastElement && !lastElement.isDeleted) {
                        // For active drawing element, check its position
                        actualDrawingPos = {
                          x: lastElement.x,
                          y: lastElement.y,
                          width: lastElement.width || 0,
                          height: lastElement.height || 0,
                          type: lastElement.type
                        };
                      }

                      eventCount++;

                      console.log(`🎯 DRAWING OFFSET #${eventCount} (${event.type}):`, {
                        timestamp: Date.now() - drawStartTime,
                        cursor: {
                          screenX: event.clientX,
                          screenY: event.clientY,
                          canvasRelativeX: Math.round(cursorCanvasX),
                          canvasRelativeY: Math.round(cursorCanvasY)
                        },
                        viewport: {
                          zoom: appState.zoom.value.toFixed(2),
                          scrollX: Math.round(appState.scrollX),
                          scrollY: Math.round(appState.scrollY)
                        },
                        expectedCanvasCoords: {
                          x: Math.round(excalidrawX),
                          y: Math.round(excalidrawY)
                        },
                        actualElement: actualDrawingPos ? {
                          type: actualDrawingPos.type,
                          x: Math.round(actualDrawingPos.x),
                          y: Math.round(actualDrawingPos.y),
                          endX: Math.round(actualDrawingPos.x + actualDrawingPos.width),
                          endY: Math.round(actualDrawingPos.y + actualDrawingPos.height)
                        } : 'NO_ELEMENT',
                        offset: actualDrawingPos ? {
                          deltaX: Math.round(excalidrawX - actualDrawingPos.x),
                          deltaY: Math.round(excalidrawY - actualDrawingPos.y)
                        } : 'N/A'
                      });
                    };

                    // Test that events fire AT ALL
                    const testHandler = (event: PointerEvent) => {
                      console.log(`🧪 TEST EVENT FIRED: ${event.type} at (${event.clientX}, ${event.clientY})`);
                    };

                    // Track when drawing starts
                    const pointerDownHandler = (event: PointerEvent) => {
                      console.log(`👇 POINTERDOWN EVENT FIRED at (${event.clientX}, ${event.clientY})`);
                      isDrawing = true;
                      drawStartTime = Date.now();
                      eventCount = 0;
                      console.log('🎨 ═══════════════════════════════════════════════════');
                      console.log('🎨 DRAWING STARTED - Real-time offset tracking enabled');
                      console.log('🎨 ═══════════════════════════════════════════════════');
                      logRealTimeCursorOffset(event);
                    };

                    // Track cursor movement while drawing
                    const pointerMoveHandler = (event: PointerEvent) => {
                      if (isDrawing) {
                        logRealTimeCursorOffset(event);
                      }
                    };

                    // Track when drawing ends
                    const pointerUpHandler = (event: PointerEvent) => {
                      console.log(`👆 POINTERUP EVENT FIRED at (${event.clientX}, ${event.clientY})`);
                      if (isDrawing) {
                        logRealTimeCursorOffset(event);
                        console.log('✅ DRAWING ENDED - Total events logged:', eventCount);
                        console.log('🎨 ═══════════════════════════════════════════════════');
                        isDrawing = false;
                      }
                    };

                    // Add test listener first
                    canvasElement.addEventListener('pointerdown', testHandler, { once: true });
                    console.log('🧪 Test listener attached - click anywhere to verify');

                    // Add main listeners
                    canvasElement.addEventListener('pointerdown', pointerDownHandler);
                    canvasElement.addEventListener('pointermove', pointerMoveHandler);
                    canvasElement.addEventListener('pointerup', pointerUpHandler);

                    console.log('🐛 Real-time cursor offset tracking attached to:', canvasElement);
                    console.log('🐛 Element parent:', canvasElement.parentElement?.className);
                    clearInterval(checkInterval);
                  } else if (attempts >= maxAttempts) {
                    console.warn('⚠️ Canvas element not found after', attempts, 'attempts');
                    clearInterval(checkInterval);
                  }
                }, 100);
              };

            attachCursorDebugListener();

            // Load libraries after API is ready
            if (api && api.updateLibrary) {
              setTimeout(async () => {
                try {
                  // Start with custom coordinate graph
                  const libraryItems = [coordinateGraphLibraryItem];

                  // Load external libraries if enabled
                  if (enableExternalLibraries) {
                    console.log('🌐 External libraries enabled');

                    // Get URLs for selected categories
                    const categoryUrls = getLibraryUrls(libraryCategories);

                    // Merge with custom URLs
                    const allUrls = [...categoryUrls, ...customLibraryUrls];

                    if (allUrls.length > 0) {
                      // Fetch all libraries in parallel
                      const externalItems = await loadLibraries(allUrls);

                      // Merge external items with coordinate graph
                      libraryItems.push(...externalItems);

                      console.log(`📚 Total library items: ${libraryItems.length} (1 custom + ${externalItems.length} external)`);
                    } else {
                      console.log('📚 No external library URLs configured');
                    }
                  } else {
                    console.log('📚 External libraries disabled - using coordinate graph only');
                  }

                  // Store library items in state for quick access panel
                  setLoadedLibraryItems(libraryItems);

                  // Log all loaded items for debugging quick access buttons
                  console.log('📋 Loaded library items:', libraryItems.map((item, idx) => ({
                    index: idx,
                    id: item.id,
                    name: item.name || 'Unnamed',
                    elementCount: item.elements?.length || 0
                  })));

                  // Update Excalidraw library with all items
                  await api.updateLibrary({
                    libraryItems: libraryItems
                  });

                  console.log('✅ Library loading complete');
                } catch (err: any) {
                  console.error('❌ Failed to load libraries:', err);
                }
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
              // CRITICAL: Explicit viewport reset to prevent localStorage zoom pollution
              zoom: { value: 1 },
              scrollX: 0,
              scrollY: 0,
            },
            scrollToContent: false,
          }}
          gridModeEnabled={gridMode}
          // Disable localStorage viewport persistence to prevent 300% zoom on reload
          autoFocus={false}
          // DISABLE native export/save to avoid modal z-index conflicts
          // Users will use the custom footer buttons instead
          UIOptions={{
            canvasActions: {
              export: false,  // Disable native export dialog (conflicts with modal)
              loadScene: false,  // Disable to simplify UI
              saveToActiveFile: false,  // Disable - use footer "Save to Disk" button
              saveAsImage: false,  // Disable - use footer "Export as PNG" button
            }
          }}
        />
      </div>
    );
  }
);

ExcalidrawCanvas.displayName = "ExcalidrawCanvas";
