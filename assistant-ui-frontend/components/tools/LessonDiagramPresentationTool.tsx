"use client";

import React, { useState, useEffect } from 'react';
import { makeAssistantToolUI } from "@assistant-ui/react";
import { DiagramDriver } from '@/lib/appwrite/driver/DiagramDriver';

interface LessonDiagramPresentationArgs {
  lessonTemplateId: string;
  cardId: string;
  diagramFileId?: string;
  diagramType?: string;
  title?: string;
}

/**
 * Display-only tool for presenting lesson diagrams
 * Shown at the top of the chat before AI lesson content
 * No user interaction required (pure display)
 */
export const LessonDiagramPresentationTool = makeAssistantToolUI<
  LessonDiagramPresentationArgs,
  unknown
>({
  toolName: "present_lesson_diagram",
  render: function LessonDiagramPresentationUI({ args }) {
    const { lessonTemplateId, cardId, diagramFileId, diagramType, title } = args;

    const [diagramUrl, setDiagramUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDiagram = async () => {
      console.log('📐 LessonDiagramPresentationTool - useEffect triggered with args:', { lessonTemplateId, cardId, diagramFileId });

      if (!lessonTemplateId || !cardId) {
        console.log('📐 LessonDiagramPresentationTool - Missing required params, skipping');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const driver = new DiagramDriver();

        // If fileId provided directly, use it (most efficient path)
        if (diagramFileId) {
          console.log('📐 LessonDiagramPresentationTool - Using provided fileId:', diagramFileId);
          const previewUrl = driver.getStoragePreviewUrl(diagramFileId);
          console.log('📐 LessonDiagramPresentationTool - Preview URL:', previewUrl);
          setDiagramUrl(previewUrl);
        } else {
          // Otherwise fetch by context (fallback)
          console.log('📐 LessonDiagramPresentationTool - Fetching by context (no fileId provided)');
          const result = await driver.getDiagramForCardByContext(
            lessonTemplateId,
            cardId,
            'lesson' // Explicit lesson context (not CFU)
          );

          if (result) {
            console.log('📐 LessonDiagramPresentationTool - Diagram fetched:', result.image_file_id);
            const previewUrl = driver.getStoragePreviewUrl(result.image_file_id);
            console.log('📐 LessonDiagramPresentationTool - Preview URL:', previewUrl);
            setDiagramUrl(previewUrl);
          } else {
            console.log('📐 LessonDiagramPresentationTool - No diagram found');
          }
        }
      } catch (err) {
        console.error('📐 LessonDiagramPresentationTool - Error:', err);
        setError('Unable to load diagram');
      } finally {
        setLoading(false);
      }
    };

    fetchDiagram();
  }, [lessonTemplateId, cardId, diagramFileId]);

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

  // Error or no diagram
  if (error || !diagramUrl) {
    return null; // Graceful degradation - no diagram, no error shown
  }

  // Display diagram
  return (
    <div className="my-4 p-6 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="space-y-4">
        {/* Title */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">📐</span>
          <h3 className="text-lg font-semibold text-blue-900">
            {title || 'Lesson Diagram'}
          </h3>
          {diagramType && (
            <span className="text-xs px-2 py-1 bg-blue-200 text-blue-700 rounded">
              {diagramType}
            </span>
          )}
        </div>

        {/* Diagram Image */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <img
            src={diagramUrl}
            alt={title || 'Lesson diagram'}
            className="max-w-full h-auto rounded"
            style={{ maxHeight: '400px', margin: '0 auto', display: 'block' }}
          />
        </div>

        {/* Context hint */}
        <p className="text-sm text-blue-600">
          💡 This diagram illustrates the concepts we'll explore in this lesson
        </p>
      </div>
    </div>
  );
  }
});
