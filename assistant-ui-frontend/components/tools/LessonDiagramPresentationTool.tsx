"use client";

import React, { useState, useEffect } from 'react';
import { makeAssistantToolUI } from "@assistant-ui/react";
import { DiagramDriver } from '@/lib/appwrite/driver/DiagramDriver';

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

    useEffect(() => {
      const fetchDiagrams = async () => {
        console.log('📐 LessonDiagramPresentationTool - useEffect triggered with args:', {
          lessonTemplateId,
          cardId,
          diagramFileId,
          lessonDiagramsCount: lessonDiagrams.length,
          cfuDiagramsCount: cfuDiagrams.length
        });

        if (!lessonTemplateId || !cardId) {
          console.log('📐 LessonDiagramPresentationTool - Missing required params, skipping');
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          const driver = new DiagramDriver();
          const diagrams: Array<{ url: string; title: string; type?: string }> = [];

          // Priority 1: Use provided diagram arrays (multi-diagram support)
          if (lessonDiagrams.length > 0 || cfuDiagrams.length > 0) {
            console.log('📐 LessonDiagramPresentationTool - Using provided diagram arrays');

            // Add lesson diagrams
            lessonDiagrams.forEach((diagram, index) => {
              const previewUrl = driver.getStoragePreviewUrl(diagram.image_file_id);
              diagrams.push({
                url: previewUrl,
                title: diagram.title || `Lesson Diagram ${index + 1}`,
                type: diagram.diagram_type
              });
              console.log(`  Added lesson diagram ${index}: ${diagram.image_file_id}`);
            });

            // Add CFU diagrams
            cfuDiagrams.forEach((diagram, index) => {
              const previewUrl = driver.getStoragePreviewUrl(diagram.image_file_id);
              diagrams.push({
                url: previewUrl,
                title: diagram.title || `CFU Diagram ${index + 1}`,
                type: diagram.diagram_type
              });
              console.log(`  Added CFU diagram ${index}: ${diagram.image_file_id}`);
            });
          }
          // Priority 2: Legacy single diagram support (backward compatibility)
          else if (diagramFileId) {
            console.log('📐 LessonDiagramPresentationTool - Using legacy single diagram (fileId):', diagramFileId);
            const previewUrl = driver.getStoragePreviewUrl(diagramFileId);
            diagrams.push({
              url: previewUrl,
              title: title || 'Lesson Diagram',
              type: diagramType
            });
          }
          // Priority 3: Fetch all diagrams for this card (on-demand fallback)
          else {
            console.log('📐 LessonDiagramPresentationTool - Fetching all diagrams for card on-demand');
            const result = await driver.getAllDiagramsForCard(lessonTemplateId, cardId);

            // Add fetched lesson diagrams
            result.lesson.forEach((diagram, index) => {
              const previewUrl = driver.getStoragePreviewUrl(diagram.image_file_id);
              diagrams.push({
                url: previewUrl,
                title: diagram.title || `Lesson Diagram ${index + 1}`,
                type: diagram.diagram_type
              });
              console.log(`  Fetched lesson diagram ${index}: ${diagram.image_file_id}`);
            });

            // Add fetched CFU diagrams
            result.cfu.forEach((diagram, index) => {
              const previewUrl = driver.getStoragePreviewUrl(diagram.image_file_id);
              diagrams.push({
                url: previewUrl,
                title: diagram.title || `CFU Diagram ${index + 1}`,
                type: diagram.diagram_type
              });
              console.log(`  Fetched CFU diagram ${index}: ${diagram.image_file_id}`);
            });
          }

          if (diagrams.length > 0) {
            console.log(`📐 LessonDiagramPresentationTool - Loaded ${diagrams.length} diagram(s)`);
            setAllDiagrams(diagrams);
          } else {
            console.log('📐 LessonDiagramPresentationTool - No diagrams found');
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

          {/* Diagram Image */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <img
              src={currentDiagram.url}
              alt={currentDiagram.title}
              className="max-w-full h-auto rounded"
              style={{ maxHeight: '400px', margin: '0 auto', display: 'block' }}
            />
          </div>

          {/* Context hint */}
          <p className="text-sm text-blue-600">
            💡 {allDiagrams.length > 1
              ? `Use the navigation buttons to view all ${allDiagrams.length} diagrams for this lesson`
              : 'This diagram illustrates the concepts we\'ll explore in this lesson'}
          </p>
        </div>
      </div>
    );
  }
});
