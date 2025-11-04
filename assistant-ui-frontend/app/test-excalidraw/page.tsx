"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import "@excalidraw/excalidraw/index.css";

// Dynamic import with SSR disabled
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

// Import export utilities separately
let exportToBlob: any = null;
if (typeof window !== "undefined") {
  import("@excalidraw/excalidraw").then((module) => {
    exportToBlob = module.exportToBlob;
  });
}

export default function TestExcalidrawPage() {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [exportedImage, setExportedImage] = useState<string | null>(null);

  const handleExport = async () => {
    if (!excalidrawAPI) {
      alert("Excalidraw API not ready yet. Please wait a moment.");
      return;
    }

    if (!exportToBlob) {
      alert("Export function not loaded yet. Please try again.");
      return;
    }

    try {
      console.log("🎨 Starting export...");

      // Get scene data
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      console.log(`📊 Elements to export: ${elements.length}`);

      if (elements.length === 0) {
        alert("Canvas is empty! Draw something first.");
        return;
      }

      // Export to blob
      const blob = await exportToBlob({
        elements,
        appState,
        files,
        mimeType: "image/png",
      });

      console.log(`📦 Blob created: ${blob.size} bytes`);

      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          const base64 = reader.result;
          console.log(`✅ Base64 export complete: ${base64.length} characters`);
          setExportedImage(base64);
        }
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("❌ Export failed:", error);
      alert(`Export failed: ${error}`);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Excalidraw Test Page</h1>
        <p className="text-gray-600 mb-6">
          Draw something below, then click "Export to PNG" to test the export functionality.
        </p>

        {/* Excalidraw Canvas */}
        <div className="mb-6 border-2 border-gray-300 rounded-lg overflow-hidden bg-white" style={{ height: "600px" }}>
          <Excalidraw
            excalidrawAPI={(api) => {
              console.log("🎨 Excalidraw API initialized:", api);
              setExcalidrawAPI(api);
            }}
            initialData={{
              appState: {
                viewBackgroundColor: "#ffffff",
                currentItemStrokeColor: "#000000",
                currentItemBackgroundColor: "transparent",
                currentItemFillStyle: "solid",
                currentItemStrokeWidth: 2,
                currentItemRoughness: 0,
                currentItemOpacity: 100,
                gridSize: 20,
              },
            }}
          />
        </div>

        {/* Export Button */}
        <div className="flex gap-4 mb-6">
          <Button
            onClick={() => {
              if (!excalidrawAPI) {
                alert("API not ready");
                return;
              }

              // Create test elements (ellipse, rectangle, freedraw)
              const testElements = [
                {
                  type: "ellipse",
                  version: 1,
                  versionNonce: 1,
                  isDeleted: false,
                  id: "test-ellipse-1",
                  fillStyle: "solid",
                  strokeWidth: 2,
                  strokeStyle: "solid",
                  roughness: 0,
                  opacity: 100,
                  angle: 0,
                  x: 200,
                  y: 150,
                  strokeColor: "#1971c2",
                  backgroundColor: "transparent",
                  width: 180,
                  height: 120,
                  seed: 1,
                  groupIds: [],
                  frameId: null,
                  roundness: null,
                  boundElements: null,
                  updated: Date.now(),
                  link: null,
                  locked: false
                },
                {
                  type: "rectangle",
                  version: 1,
                  versionNonce: 2,
                  isDeleted: false,
                  id: "test-rect-1",
                  fillStyle: "solid",
                  strokeWidth: 2,
                  strokeStyle: "solid",
                  roughness: 0,
                  opacity: 100,
                  angle: 0,
                  x: 450,
                  y: 180,
                  strokeColor: "#e03131",
                  backgroundColor: "transparent",
                  width: 140,
                  height: 90,
                  seed: 2,
                  groupIds: [],
                  frameId: null,
                  roundness: null,
                  boundElements: null,
                  updated: Date.now(),
                  link: null,
                  locked: false
                },
                {
                  type: "freedraw",
                  version: 1,
                  versionNonce: 3,
                  isDeleted: false,
                  id: "test-draw-1",
                  fillStyle: "solid",
                  strokeWidth: 2,
                  strokeStyle: "solid",
                  roughness: 0,
                  opacity: 100,
                  angle: 0,
                  x: 180,
                  y: 350,
                  strokeColor: "#2f9e44",
                  backgroundColor: "transparent",
                  width: 200,
                  height: 100,
                  seed: 3,
                  groupIds: [],
                  frameId: null,
                  roundness: null,
                  boundElements: null,
                  updated: Date.now(),
                  link: null,
                  locked: false,
                  points: [[0, 0], [50, -30], [100, -20], [150, 10], [200, 40]],
                  lastCommittedPoint: null,
                  simulatePressure: true,
                  pressures: []
                }
              ];

              excalidrawAPI.updateScene({ elements: testElements });
              console.log("✅ Added test elements to canvas");
            }}
            variant="default"
            size="lg"
          >
            Add Test Shapes
          </Button>
          <Button onClick={handleExport} size="lg">
            Export to PNG
          </Button>
          <Button
            onClick={() => {
              console.log("API state:", excalidrawAPI ? "Ready" : "Not ready");
              console.log("Export function:", exportToBlob ? "Loaded" : "Not loaded");
            }}
            variant="outline"
            size="lg"
          >
            Check API Status
          </Button>
        </div>

        {/* Exported Image Preview */}
        {exportedImage && (
          <div className="bg-white p-6 rounded-lg border-2 border-green-500">
            <h2 className="text-xl font-bold mb-4 text-green-700">✅ Export Successful!</h2>
            <p className="text-sm text-gray-600 mb-4">
              Base64 length: {exportedImage.length} characters (~{Math.round(exportedImage.length / 1024)}KB)
            </p>
            <div className="border border-gray-300 rounded p-4 bg-gray-50">
              <img src={exportedImage} alt="Exported drawing" className="max-w-full" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
