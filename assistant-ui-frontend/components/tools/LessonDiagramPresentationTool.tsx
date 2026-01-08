"use client";

import React, { useState, useEffect } from 'react';
import { makeAssistantToolUI } from "@assistant-ui/react";
import { DiagramDriver } from '@/lib/appwrite/driver/DiagramDriver';
import { ImageZoomModal } from '@/components/ui/image-zoom-modal';
import { Expand } from 'lucide-react';

interface DiagramData {
  image_file_id: string;
  diagram_type?: string;
  title?: string;
  diagram_index?: number;
}

interface LessonDiagramPresentationArgs {
  lessonTemplateId: string;
  cardId: string;
  // Legacy single diagram support (backward compatibility)
  diagramFileId?: string;
  diagramType?: string;
  title?: string;
  // New multi-diagram support
  lessonDiagrams?: DiagramData[];
  cfuDiagrams?: DiagramData[];
}

/**
 * Display tool for presenting lesson diagrams with carousel support
 * Supports multiple diagrams per card (lesson context and CFU context)
 * Shown at the top of the chat before AI lesson content
 * No user interaction required beyond carousel navigation
 */
export const LessonDiagramPresentationTool = makeAssistantToolUI<
  LessonDiagramPresentationArgs,
  unknown
>({
  toolName: "present_lesson_diagram",
  render: function LessonDiagramPresentationUI({ args }) {
    const {
      lessonTemplateId,
      cardId,
      diagramFileId,
      diagramType,
      title,
      lessonDiagrams = [],
      cfuDiagrams = []
    } = args;

    const [allDiagrams, setAllDiagrams] = useState<Array<{ url: string; title: string; type?: string }>>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [zoomModalOpen, setZoomModalOpen] = useState(false);

    useEffect(() => {
      const fetchDiagrams = async () => {
        if (!lessonTemplateId || !cardId) {
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          const driver = new DiagramDriver();
          const diagrams: Array<{ url: string; title: string; type?: string }> = [];

          // Priority 1: Use provided diagram arrays (multi-diagram support)
          if (lessonDiagrams.length > 0 || cfuDiagrams.length > 0) {
            // Add lesson diagrams
            lessonDiagrams.forEach((diagram, index) => {
              const previewUrl = driver.getStoragePreviewUrl(diagram.image_file_id);
              diagrams.push({
                url: previewUrl,
                title: diagram.title || `Lesson Diagram ${index + 1}`,
                type: diagram.diagram_type
              });
            });

            // Add CFU diagrams
            cfuDiagrams.forEach((diagram, index) => {
              const previewUrl = driver.getStoragePreviewUrl(diagram.image_file_id);
              diagrams.push({
                url: previewUrl,
                title: diagram.title || `CFU Diagram ${index + 1}`,
                type: diagram.diagram_type
              });
            });
          }
          // Priority 2: Legacy single diagram support (backward compatibility)
          else if (diagramFileId) {
            const previewUrl = driver.getStoragePreviewUrl(diagramFileId);
            diagrams.push({
              url: previewUrl,
              title: title || 'Lesson Diagram',
              type: diagramType
            });
          }
          // Priority 3: Fetch all diagrams for this card (on-demand fallback)
          else {
            const result = await driver.getAllDiagramsForCard(lessonTemplateId, cardId);

            // Add fetched lesson diagrams
            result.lesson.forEach((diagram, index) => {
              const previewUrl = driver.getStoragePreviewUrl(diagram.image_file_id);
              diagrams.push({
                url: previewUrl,
                title: diagram.title || `Lesson Diagram ${index + 1}`,
                type: diagram.diagram_type
              });
            });

            // Add fetched CFU diagrams
            result.cfu.forEach((diagram, index) => {
              const previewUrl = driver.getStoragePreviewUrl(diagram.image_file_id);
              diagrams.push({
                url: previewUrl,
                title: diagram.title || `CFU Diagram ${index + 1}`,
                type: diagram.diagram_type
              });
            });
          }

          if (diagrams.length > 0) {
            setAllDiagrams(diagrams);
          }
        } catch (err) {
          console.error('📐 LessonDiagramPresentationTool - Error:', err);
          setError('Unable to load diagrams');
        } finally {
          setLoading(false);
        }
      };

      fetchDiagrams();
    }, [lessonTemplateId, cardId, diagramFileId, JSON.stringify(lessonDiagrams), JSON.stringify(cfuDiagrams)]);

    // Handler functions for carousel navigation
    const handlePrevious = () => {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : allDiagrams.length - 1));
    };

    const handleNext = () => {
      setCurrentIndex((prev) => (prev < allDiagrams.length - 1 ? prev + 1 : 0));
    };

    // Loading state
    if (loading) {
      return (
        <div className="my-4 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="animate-pulse">
            <div className="h-6 bg-blue-200 rounded w-1/3 mb-4"></div>
            <div className="h-64 bg-blue-200 rounded"></div>
          </div>
        </div>
      );
    }

    // Error or no diagrams
    if (error || allDiagrams.length === 0) {
      return null; // Graceful degradation - no diagrams, no error shown
    }

    const currentDiagram = allDiagrams[currentIndex];

    // Display diagrams with carousel
    return (
      <div className="my-4 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="space-y-4">
          {/* Title and navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📐</span>
              <h3 className="text-lg font-semibold text-blue-900">
                {currentDiagram.title}
              </h3>
              {currentDiagram.type && (
                <span className="text-xs px-2 py-1 bg-blue-200 text-blue-700 rounded">
                  {currentDiagram.type}
                </span>
              )}
            </div>

            {/* Carousel controls (only show if multiple diagrams) */}
            {allDiagrams.length > 1 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrevious}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  aria-label="Previous diagram"
                >
                  ← Prev
                </button>
                <span className="text-sm text-blue-700 font-medium">
                  {currentIndex + 1} / {allDiagrams.length}
                </span>
                <button
                  onClick={handleNext}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  aria-label="Next diagram"
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          {/* Diagram Image - Clickable to expand */}
          <div
            className="bg-white rounded-lg p-4 shadow-sm relative group cursor-zoom-in"
            onClick={() => setZoomModalOpen(true)}
          >
            <img
              src={currentDiagram.url}
              alt={currentDiagram.title}
              className="max-w-full h-auto rounded transition-transform"
              style={{ maxHeight: '400px', margin: '0 auto', display: 'block' }}
            />
            {/* Persistent expand badge - top right corner */}
            <div className="absolute top-6 right-6 bg-blue-600 text-white p-2 rounded-full shadow-lg group-hover:scale-110 transition-transform">
              <Expand className="h-4 w-4" />
            </div>
            {/* Expand overlay on hover */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg pointer-events-none">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium shadow-lg">
                <Expand className="h-4 w-4" />
                <span>Click to expand</span>
              </div>
            </div>
          </div>

          {/* Context hint */}
          <p className="text-sm text-blue-600">
            💡 {allDiagrams.length > 1
              ? `Click any diagram to expand • Use navigation to view all ${allDiagrams.length} diagrams`
              : 'Click the diagram to expand and zoom • Pinch or scroll to zoom'}
          </p>
        </div>

        {/* Zoom Modal */}
        <ImageZoomModal
          open={zoomModalOpen}
          onOpenChange={setZoomModalOpen}
          images={allDiagrams}
          initialIndex={currentIndex}
        />
      </div>
    );
  }
});
