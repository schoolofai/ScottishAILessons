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

  /**
   * Insert a library item onto the canvas by its ID
   * @param itemId - The ID of the library item to insert
   */
  insertLibraryItem: (itemId: string) => void;
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
      }
    }), [excalidrawAPI, loadedLibraryItems]);

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
