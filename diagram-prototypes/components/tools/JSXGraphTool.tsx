"use client";

import React, { useEffect, useRef, useState } from "react";
import type { JSXGraphDiagram } from "@/lib/diagram-schemas";
import { validateDiagram } from "@/lib/diagram-schemas";

interface JSXGraphToolProps {
  args: JSXGraphDiagram;
  status?: { type: string };
}

export const JSXGraphTool: React.FC<JSXGraphToolProps> = ({ args, status }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderTime, setRenderTime] = useState<number>(0);
  const [elementCount, setElementCount] = useState<number>(0);
  const boardIdRef = useRef<string>(`jxgbox-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (!validateDiagram(args)) {
      setError("Invalid diagram configuration");
      return;
    }

    const loadJSXGraph = async () => {
      try {
        const startTime = performance.now();
        // JSXGraph exports JXG, which contains JSXGraph
        const JXG = (await import("jsxgraph")).default;

        if (!containerRef.current) {
          throw new Error("Container ref not available");
        }

        if (boardRef.current) {
          JXG.JSXGraph.freeBoard(boardRef.current);
          boardRef.current = null;
        }

        // Use the containerRef directly instead of board ID
        const board = JXG.JSXGraph.initBoard(containerRef.current, {
          boundingbox: args.board.boundingbox,
          axis: args.board.axis ?? true,
          showCopyright: args.board.showCopyright ?? false,
          showNavigation: args.board.showNavigation ?? false,
          keepAspectRatio: args.board.keepAspectRatio ?? true,
          grid: args.board.grid ?? false,
          pan: args.board.pan,
          zoom: args.board.zoom,
        });

        boardRef.current = board;
        const elementRefs: Record<string, any> = {};

        for (const element of args.elements) {
          try {
            // Process arguments: handle function strings and element references
            const processedArgs = element.args.map((arg: any) => {
              // Handle function strings for dynamic text
              // Pattern: "() => expression" or "() => { statements }"
              // EXCEPT for functiongraph elements - they have their own parser
              if (typeof arg === "string" && arg.startsWith("() =>") && element.type !== "functiongraph") {
                // Create a proper closure that captures board
                // The function body references 'board', so we need it in scope when eval runs
                const funcBody = arg.substring(6).trim();

                // Create closure with board available by name in the eval context
                if (funcBody.startsWith("{")) {
                  // Block statement - create function directly with closure
                  return (function(boardRef) {
                    const board = boardRef; // Make 'board' available by that name
                    return eval(`(function() ${funcBody})`);
                  })(board);
                } else {
                  // Expression - wrap in return
                  return (function(boardRef) {
                    const board = boardRef; // Make 'board' available by that name
                    return eval(`(function() { return ${funcBody}; })`);
                  })(board);
                }
              }
              // Handle direct element ID references (not names)
              if (typeof arg === "string" && elementRefs[arg]) {
                return elementRefs[arg];
              }
              // Handle arrays of string references (for polygon, angle, etc.)
              // These need to be resolved to actual point objects
              if (Array.isArray(arg)) {
                return arg.map((item: any) => {
                  // If it's a string reference to a point name, resolve it
                  if (typeof item === "string") {
                    const point = board.select(item);
                    if (point) {
                      return point;
                    }
                  }
                  // Otherwise keep as-is (could be coordinates, etc.)
                  return item;
                });
              }
              // Keep everything else as-is
              return arg;
            });

            // Flatten arrays for polygon/angle elements that expect point objects as flat arguments
            // JSXGraph polygon expects: [pointA, pointB, pointC] not [[pointA, pointB, pointC]]
            const finalArgs = processedArgs.length === 1 && Array.isArray(processedArgs[0])
              ? processedArgs[0]
              : processedArgs;

            const jsxElement = board.create(element.type, finalArgs, element.attributes || {});

            if (element.id) {
              elementRefs[element.id] = jsxElement;
            }
          } catch (elemErr) {
            console.error(`Error creating element ${element.type}:`, elemErr);
            const errMsg = elemErr instanceof Error ? elemErr.message : String(elemErr);
            throw new Error(`Failed to create ${element.type}: ${errMsg}`);
          }
        }

        const endTime = performance.now();
        setRenderTime(endTime - startTime);
        setElementCount(args.elements.length);
        setError(null);

      } catch (loadErr) {
        console.error("JSXGraph initialization error:", loadErr);
        const errMsg = loadErr instanceof Error ? loadErr.message : "Failed to load diagram";
        setError(errMsg);
      }
    };

    loadJSXGraph();

    return () => {
      if (boardRef.current) {
        try {
          // Dynamic import for cleanup
          import("jsxgraph").then((module) => {
            const JXG = module.default;
            if (boardRef.current) {
              JXG.JSXGraph.freeBoard(boardRef.current);
              boardRef.current = null;
            }
          });
        } catch (cleanupErr) {
          console.error("Cleanup error:", cleanupErr);
        }
      }
    };
  }, [args]);

  const handleReset = () => {
    if (boardRef.current) {
      boardRef.current.setBoundingBox(args.board.boundingbox);
    }
  };

  return (
    <div className="jsxgraph-container space-y-4">
      {args.title && (
        <div className="mb-4">
          <h3 className="text-xl font-semibold mb-2">{args.title}</h3>
          {args.description && (
            <p className="text-gray-600 text-sm">{args.description}</p>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div
        ref={containerRef}
        className="jxgbox border border-gray-300 rounded-lg shadow-sm bg-white"
        style={{ width: "100%", height: "500px" }}
        aria-label={args.title || "Interactive diagram"}
      />

      <div className="flex justify-between items-center text-sm">
        <div className="text-gray-500">
          Rendered {elementCount} elements in {renderTime.toFixed(2)}ms
        </div>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          aria-label="Reset diagram view"
        >
          Reset View
        </button>
      </div>

      {args.metadata && (
        <div className="text-xs text-gray-500 space-y-1">
          {args.metadata.subject && <div>Subject: {args.metadata.subject}</div>}
          {args.metadata.difficulty && <div>Difficulty: {args.metadata.difficulty}</div>}
          {args.metadata.interactivity && <div>Interactivity: {args.metadata.interactivity}</div>}
        </div>
      )}
    </div>
  );
};
