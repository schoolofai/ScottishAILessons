"use client";

import React, { useState, useEffect } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import {
  useSafeLangGraphInterruptState,
  useSafeLangGraphSendCommand
} from "@/lib/replay/useSafeLangGraphHooks";
import { useCurrentCard } from "@/contexts/CurrentCardContext";
import { useReplayMode } from "@/contexts/ReplayModeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BookOpenIcon, UserIcon, ClockIcon } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { DiagramDriver } from "@/lib/appwrite/driver/DiagramDriver";
import { StudentDrawingStorageDriver } from "@/lib/appwrite/driver/StudentDrawingStorageDriver";
import { useAppwrite } from "@/lib/appwrite/hooks/useAppwrite";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { DrawingModal } from "@/components/ui/drawing-modal";
import { useRetryPrepopulation } from "@/contexts/RetryPrepopulationContext";

type LessonCardPresentationArgs = {
  card_content: string;
  card_data: {
    id: string;
    title: string;
    explainer: string;
    explainer_plain: string;
    misconceptions: Array<{
      id: string;
      misconception: string;
      clarification: string;
    }>;
    context_hooks?: string[];
    cfu: {
      type: "mcq" | "numeric" | "structured_response" | "short_text";
      id: string;
      stem: string;
      // MCQ fields
      options?: string[];
      answerIndex?: number;
      // Numeric fields
      expected?: number;
      tolerance?: number;
      money2dp?: boolean;
      hints?: string[];
      // All CFU types have rubric
      rubric: {
        total_points: number;
        criteria: Array<{
          description: string;
          points: number;
        }>;
      };
    };
  };
  card_index: number;
  total_cards: number;
  cfu_type: string;
  lesson_context: {
    lesson_title: string;
    student_name: string;
    progress: string;
  };
  interaction_id: string;
  timestamp: string;
  // Storage upload fields (Phase 10 - Drawing Storage Migration)
  session_id?: string;  // Required for storage file naming
  student_id?: string;  // Required for storage permissions
  // Retry prepopulation fields
  attempt_number?: number;  // Signal retry (1=first attempt, 2+=retry)
};

// Multi-image vision API limits
const IMAGE_LIMITS = {
  MAX_IMAGES: 5,
  MAX_TOTAL_SIZE_MB: 3,
  MAX_INDIVIDUAL_SIZE_KB: 800,
  WARN_TOTAL_SIZE_MB: 2,
} as const;

export const LessonCardPresentationTool = makeAssistantToolUI<
  LessonCardPresentationArgs,
  unknown
>({
  toolName: "lesson_card_presentation",
  render: function LessonCardPresentationUI({ args }) {
    // Check if we're in replay mode
    const { isReplayMode } = useReplayMode();

    // Get interrupt state and sendCommand hook
    // Safe versions that won't throw in replay mode
    const interrupt = useSafeLangGraphInterruptState();
    const sendCommand = useSafeLangGraphSendCommand();

    // Get current card context for updating with real-time card data
    const { currentCard, setCurrentCard } = useCurrentCard();

    // Appwrite driver factory for storage uploads
    const { createDriver } = useAppwrite();

    // Retry prepopulation context
    const { storeAttempt, getAttempt } = useRetryPrepopulation();

    // Component state - must be before early return to avoid hook order issues
    const [studentAnswer, setStudentAnswer] = useState<string>("");
    const [selectedMCQOption, setSelectedMCQOption] = useState<string>("");
    const [showHint, setShowHint] = useState(false);
    const [hintIndex, setHintIndex] = useState(0);

    // Drawing state - universal for all CFU types
    const [studentDrawing, setStudentDrawing] = useState<string | null>(null);
    const [studentDrawingText, setStudentDrawingText] = useState<string>("");
    const [studentDrawingSceneData, setStudentDrawingSceneData] = useState<any | null>(null); // Excalidraw scene for editable restoration
    const [showDrawModal, setShowDrawModal] = useState(false);

    // Upload state - for managing drawing uploads to storage
    const [isUploadingDrawing, setIsUploadingDrawing] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Diagram state - for fetching and displaying lesson diagrams
    const [diagramUrl, setDiagramUrl] = useState<string | null>(null);
    const [diagramLoading, setDiagramLoading] = useState<boolean>(false);

    // Stem renderer component for proper markdown and newline formatting
    const StemRenderer = ({ stem, className }: { stem: string; className?: string }) => {
      // Handle both literal "\n" strings and actual newline characters
      // Convert them to double newlines for proper markdown paragraph breaks
      let processedStem = stem;

      // First, convert literal "\n" strings (escaped) to actual newlines
      processedStem = processedStem.replace(/\\n/g, '\n');

      // Then convert single newlines to double newlines for markdown paragraphs
      processedStem = processedStem.replace(/\n/g, '\n\n');

      return (
        <div className={`prose prose-sm max-w-none ${className || ''}`}>
          <ReactMarkdown
            components={{
              p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
              strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
              em: ({ node, ...props }) => <em className="italic" {...props} />,
              ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-2" {...props} />,
              ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-2" {...props} />,
              li: ({ node, ...props }) => <li className="mb-1" {...props} />,
            }}
          >
            {processedStem}
          </ReactMarkdown>
        </div>
      );
    };

    // Component mount tracking (removed noisy logs)
    // Use React DevTools to debug component lifecycle
    useEffect(() => {
      if (!interrupt) {
        // Only log when there's a potential issue
        console.warn('⚠️ LessonCardTool - NO INTERRUPT - Component will not render');
      }

      if (interrupt && !args?.card_data) {
        console.error('❌ LessonCardTool - Has interrupt but missing card_data in args');
      }
    }, [interrupt, args]);

    // Update CurrentCardContext with card data for context-aware chat
    useEffect(() => {
      // Only update if we have valid card_data
      if (!args.card_data || !args.card_data.cfu) {
        console.error('❌ LessonCardTool useEffect - Missing card_data or cfu');
        return;
      }

      console.log('🎯 LessonCardTool - Updating CurrentCardContext with:', {
        card_index: args.card_index,
        card_id: args.card_data.id,
        lesson_title: args.lesson_context?.lesson_title
      });

      setCurrentCard({
        card_data: args.card_data,
        card_index: args.card_index,
        total_cards: args.total_cards,
        interaction_state: "presenting",
        lesson_context: args.lesson_context
      });

      // Cleanup: Mark as completed when component unmounts
      return () => {
        console.log('🎯 LessonCardTool - Component unmounting, marking card as completed');
        setCurrentCard(prev => prev ? {
          ...prev,
          interaction_state: "completed"
        } : null);
      };
    }, [args.card_data?.id, args.card_index, args.total_cards, args.lesson_context, setCurrentCard]);

    // Fetch diagram for current card
    useEffect(() => {
      // Extract lessonTemplateId from various possible locations
      const lessonTemplateId =
        (args as any).lesson_template_id || // Direct field
        (args as any).lesson_snapshot?.lessonTemplateId || // From snapshot
        args.lesson_context?.lesson_template_id; // From context

      const cardId = args.card_data?.id;

      console.log('📊 DiagramFetch - Attempting to fetch diagram:', {
        lessonTemplateId,
        cardId,
        hasLessonTemplateId: !!lessonTemplateId,
        hasCardId: !!cardId
      });

      // Only fetch if we have both required IDs
      if (!lessonTemplateId || !cardId) {
        console.warn('⚠️ DiagramFetch - Missing required IDs, skipping diagram fetch');
        return;
      }

      const fetchDiagram = async () => {
        setDiagramLoading(true);
        try {
          console.log('🔍 DiagramFetch - Querying Appwrite for CFU diagram...');
          // Initialize driver without session token (Storage bucket must have public read permissions)
          // Alternative: Pass session token if bucket is private: new DiagramDriver(sessionToken)
          const driver = new DiagramDriver();
          const result = await driver.getCFUDiagramWithPreviewUrl(lessonTemplateId, cardId);

          if (result) {
            console.log('✅ DiagramFetch - CFU diagram found:', {
              fileId: result.diagram.image_file_id,
              previewUrl: result.previewUrl,
              diagramType: result.diagram.diagram_type,
              diagramContext: result.diagram.diagram_context
            });
            setDiagramUrl(result.previewUrl);
          } else {
            console.log('ℹ️ DiagramFetch - No diagram exists for this card (expected for cards without diagrams)');
            setDiagramUrl(null);
          }
        } catch (error) {
          console.error('❌ DiagramFetch - Failed to fetch diagram:', error);
          // Silent fail - no diagram shown (graceful degradation)
          setDiagramUrl(null);
        } finally {
          setDiagramLoading(false);
        }
      };

      fetchDiagram();
    }, [args.card_data?.id, (args as any).lesson_template_id, (args as any).lesson_snapshot?.lessonTemplateId, args.lesson_context?.lesson_template_id]);

    // ✅ NEW: Prepopulate from previous attempt on retry
    useEffect(() => {
      const cardId = args.card_data?.id;
      if (!cardId) return;

      // Check if this is a retry (attempt_number > 1 OR previous data exists)
      const previousAttempt = getAttempt(cardId);
      const isRetry = (args.attempt_number && args.attempt_number > 1) || previousAttempt;

      if (!isRetry || !previousAttempt) {
        return;
      }

      // Log retry restoration
      console.log('🔄 Retry - restoring previous attempt:', {
        cardId,
        attemptNumber: args.attempt_number,
        hasSceneData: !!previousAttempt.drawing_scene_data,
        elements: previousAttempt.drawing_scene_data?.elements?.length || 0
      });

      // Prepopulate text/MCQ response
      if (previousAttempt.response) {
        if (args.cfu_type === 'mcq') {
          setSelectedMCQOption(previousAttempt.response);
        } else if (args.cfu_type === 'structured_response' && previousAttempt.response_with_images) {
          // For structured_response, use original HTML with images (not cleaned HTML)
          setStudentAnswer(previousAttempt.response_with_images);
        } else {
          setStudentAnswer(previousAttempt.response);
        }
      }

      // Prepopulate drawing text explanation
      if (previousAttempt.drawing_text) {
        setStudentDrawingText(previousAttempt.drawing_text);
      }

      // Prepopulate Excalidraw scene data for editable restoration
      if (previousAttempt.drawing_scene_data) {
        setStudentDrawingSceneData(previousAttempt.drawing_scene_data);
      }

    }, [args.card_data?.id, args.attempt_number, args.cfu_type]);

    // CHECK: Only render if there's an interrupt
    // In replay mode, render even without interrupt (tool calls trigger rendering)
    // In live mode, only render when we have an interrupt
    if (!isReplayMode && !interrupt) return null;

    // DATA: Get from tool call args (NOT from interrupt.value)
    const { card_content, card_data, card_index, total_cards, cfu_type, lesson_context } = args;

    // VALIDATION: Ensure card_data and cfu exist before rendering
    if (!card_data || !card_data.cfu) {
      console.error('❌ LessonCardTool - Missing required card_data or cfu:', {
        hasCardData: !!card_data,
        hasCfu: card_data ? !!card_data.cfu : false,
        args
      });
      return (
        <Card className="w-full max-w-4xl mx-auto">
          <CardContent className="p-6 text-center">
            <p className="text-red-600">Error: Invalid lesson card data. Please try again.</p>
          </CardContent>
        </Card>
      );
    }

    // Calculate progress
    const progress = ((card_index + 1) / total_cards) * 100;

    // Extract base64 images from HTML content with multi-image support and validation
    /**
     * Extract scene data from HTML images with data-scene attributes
     * Returns the FIRST scene data found (for editable restoration)
     */
    const extractSceneDataFromHtml = (html: string): any | null => {
      try {
        // Use DOM parser to properly handle HTML-encoded attributes
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Find first image with data-scene attribute
        const imgWithScene = tempDiv.querySelector('img[data-scene]');

        if (imgWithScene) {
          const sceneDataJson = imgWithScene.getAttribute('data-scene');

          if (sceneDataJson) {
            return JSON.parse(sceneDataJson);
          }
        }

        return null;
      } catch (error) {
        console.error('Failed to extract scene data from HTML:', error);
        return null;
      }
    };

    const extractImageFromHtml = (html: string): {
      cleanedHtml: string;
      images: string[];  // Array of base64 strings
      imageCount: number;
      totalSizeBytes: number;
      validationErrors: string[];
    } => {
      const imgRegex = /<img[^>]*src="data:image\/png;base64,([A-Za-z0-9+/=]+)"[^>]*>/g;
      const matches = Array.from(html.matchAll(imgRegex));

      if (matches.length === 0) {
        return { cleanedHtml: html, images: [], imageCount: 0, totalSizeBytes: 0, validationErrors: [] };
      }

      const images: string[] = [];
      const validationErrors: string[] = [];
      let totalSizeBytes = 0;

      // Extract and validate each image
      for (let i = 0; i < matches.length; i++) {
        const base64 = matches[i][1];

        // Calculate size: base64 string length * 0.75 = approximate byte size
        const sizeBytes = Math.ceil(base64.length * 0.75);
        const sizeKB = sizeBytes / 1024;

        totalSizeBytes += sizeBytes;

        // Validate individual image size
        if (sizeKB > IMAGE_LIMITS.MAX_INDIVIDUAL_SIZE_KB) {
          validationErrors.push(
            `Image ${i + 1} is too large (${Math.round(sizeKB)}KB). Maximum size per image is ${IMAGE_LIMITS.MAX_INDIVIDUAL_SIZE_KB}KB.`
          );
        }

        images.push(base64);
      }

      // Validate total image count
      if (images.length > IMAGE_LIMITS.MAX_IMAGES) {
        validationErrors.push(
          `Too many images (${images.length}). Maximum allowed is ${IMAGE_LIMITS.MAX_IMAGES} images.`
        );
      }

      // Validate total size
      const totalSizeMB = totalSizeBytes / (1024 * 1024);
      if (totalSizeMB > IMAGE_LIMITS.MAX_TOTAL_SIZE_MB) {
        validationErrors.push(
          `Total image size is too large (${totalSizeMB.toFixed(2)}MB). Maximum total size is ${IMAGE_LIMITS.MAX_TOTAL_SIZE_MB}MB.`
        );
      }

      // Replace images with numbered placeholders
      let cleanedHtml = html;
      let imageNum = 1;
      cleanedHtml = cleanedHtml.replace(
        imgRegex,
        () => `<p><em>[Drawing ${imageNum++} submitted]</em></p>`
      );

      console.log('🎨 IMAGE EXTRACTION - Multi-image support:', {
        imageCount: images.length,
        totalSizeBytes,
        totalSizeMB: totalSizeMB.toFixed(2),
        validationErrors: validationErrors.length,
        cleanedHtmlLength: cleanedHtml.length,
        imageSizes: images.map((img, i) => `Image ${i + 1}: ${Math.round((img.length * 0.75) / 1024)}KB`)
      });

      return { cleanedHtml, images, imageCount: images.length, totalSizeBytes, validationErrors };
    };

    const handleSubmitAnswer = async () => {
      const finalAnswer = cfu_type === "mcq" ? selectedMCQOption : studentAnswer;

      // ✅ FRONTEND EXTRACTION: Extract images from HTML with multi-image support
      let allImages: string[] = [];
      let extractedImageText = studentDrawingText;
      let cleanedAnswer = finalAnswer;
      let validationErrors: string[] = [];

      // Step 1: Add studentDrawing from DrawingModal if present
      if (studentDrawing) {
        allImages.push(studentDrawing);
      }

      // Step 2: Extract embedded images from RichTextEditor (for structured_response)
      let extractedSceneData: any | null = null;
      if (cfu_type === "structured_response" && finalAnswer) {
        const extraction = extractImageFromHtml(finalAnswer);

        if (extraction.images.length > 0) {
          allImages = [...allImages, ...extraction.images];
          cleanedAnswer = extraction.cleanedHtml;
          validationErrors = extraction.validationErrors;

          // Generate description from cleaned HTML if not already provided
          if (!extractedImageText) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = extraction.cleanedHtml;
            extractedImageText = tempDiv.textContent?.trim() || `Student submitted ${extraction.imageCount} diagram(s) with written response`;

            if (extractedImageText.length > 200) {
              extractedImageText = extractedImageText.substring(0, 200) + "...";
            }
          }

          // Extract scene data from HTML for editable restoration
          extractedSceneData = extractSceneDataFromHtml(finalAnswer);
        }
      }

      // Step 3: Check for validation errors
      if (validationErrors.length > 0) {
        alert(`Cannot submit answer due to image validation errors:\n\n${validationErrors.join('\n')}`);
        return;
      }

      // Step 4: Validate - must have text answer OR drawing
      const hasTextAnswer = cleanedAnswer?.trim() || selectedMCQOption;
      const hasDrawing = allImages.length > 0;

      if (!hasTextAnswer && !hasDrawing) {
        alert("Please provide an answer or drawing before submitting.");
        return;
      }

      // Step 5: UPLOAD DRAWINGS TO STORAGE (NEW - Phase 10)
      let fileIds: string[] = [];

      if (hasDrawing && args.session_id) {
        try {
          setIsUploadingDrawing(true);
          setUploadError(null);

          console.log('🎨 STORAGE UPLOAD - Uploading drawings to Appwrite Storage:', {
            image_count: allImages.length,
            session_id: args.session_id,
            card_id: card_data.id
          });

          const storageDriver = createDriver(StudentDrawingStorageDriver);
          fileIds = await storageDriver.batchUploadDrawings(
            args.session_id,
            card_data.id,
            allImages
          );

          console.log('✅ STORAGE UPLOAD - Successfully uploaded drawings:', {
            file_ids: fileIds,
            count: fileIds.length
          });

        } catch (uploadError: any) {
          console.error('❌ STORAGE UPLOAD - Failed to upload drawings:', uploadError);
          setUploadError(uploadError.message);
          setIsUploadingDrawing(false);

          alert(`Failed to upload drawing(s): ${uploadError.message}\n\nPlease try again.`);
          return; // Don't submit if upload fails
        } finally {
          setIsUploadingDrawing(false);
        }
      } else if (hasDrawing && !args.session_id) {
        console.warn('⚠️ STORAGE UPLOAD - session_id not provided, falling back to base64');
        // Fallback to legacy base64 approach if session_id not provided
      }

      // Step 6: Prepare drawing field for backend
      // NEW: Send file IDs if uploaded to storage
      // LEGACY: Send base64 strings if storage upload skipped
      const studentDrawingFileIds = fileIds.length > 0 ? fileIds : null;
      const studentDrawingField =
        allImages.length === 0 ? null :
        fileIds.length > 0 ? null :  // Skip base64 if we have file IDs
        allImages.length === 1 ? allImages[0] :
        JSON.stringify(allImages);


      // Update interaction state to "evaluating" AND store previous answer for retry
      setCurrentCard(prev => prev ? {
        ...prev,
        interaction_state: "evaluating",
        previous_answer: cleanedAnswer,
        previous_drawing: studentDrawingField || undefined,
        previous_drawing_text: extractedImageText || undefined
      } : null);

      // Store attempt for retry prepopulation

      const attemptData = {
        response: cleanedAnswer || selectedMCQOption || "",
        response_with_images: (cfu_type === "structured_response" && finalAnswer) ? finalAnswer : undefined,  // Original HTML with images for retry
        drawing_file_ids: studentDrawingFileIds || [],  // Phase 10: Storage file IDs (default to empty array)
        drawing: studentDrawingField,  // Legacy: base64 fallback
        drawing_text: extractedImageText || "",
        drawing_scene_data: extractedSceneData || studentDrawingSceneData,  // Excalidraw scene for editable restoration (extracted from HTML or standalone modal)
        timestamp: Date.now()
      };

      // Store attempt data for retry prepopulation
      if (attemptData.drawing_scene_data) {
        console.log('💾 Attempt stored with editable scene data:', {
          cardId: args.card_data.id,
          elements: attemptData.drawing_scene_data.elements?.length || 0
        });
      }

      storeAttempt(args.card_data.id, attemptData);

      // Send command with EXTRACTED data (clean HTML + file IDs or base64 fallback)
      sendCommand({
        resume: JSON.stringify({
          action: "submit_answer",
          student_response: cleanedAnswer,           // ✅ Clean HTML (no embedded images)
          student_drawing_file_ids: studentDrawingFileIds,  // ✅ NEW: Array of storage file IDs
          student_drawing: studentDrawingField,      // ✅ LEGACY: String/JSON array/null (fallback)
          student_drawing_text: extractedImageText || null, // ✅ Include drawing text
          interaction_type: "answer_submission",
          card_id: card_data.id,
          interaction_id: args.interaction_id,
          timestamp: new Date().toISOString()
        })
      });
    };

    const handleRequestHint = () => {
      setShowHint(true);
      // Could trigger hint command if needed
    };

    return (
      <>
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpenIcon className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg">{lesson_context.lesson_title}</CardTitle>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <UserIcon className="w-4 h-4" />
              <span>{lesson_context.student_name}</span>
            </div>
          </div>
          
          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span>Progress: Card {card_index + 1} of {total_cards}</span>
              <Badge variant="outline">{Math.round(progress)}% Complete</Badge>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Interactive question section */}
          <div className="border-t pt-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-orange-500" />
              Your Turn to Answer
            </h3>

            {/* Diagram Display - shown above question if available */}
            {diagramUrl && (
              <div className="mb-6">
                <img
                  src={diagramUrl}
                  alt={`Diagram for ${card_data.title}`}
                  className="w-full max-w-2xl mx-auto rounded-lg border border-gray-200 shadow-sm"
                  loading="lazy"
                  onError={(e) => {
                    console.error('❌ DiagramRender - Failed to load diagram image:', diagramUrl);
                    // Hide image on load error (graceful degradation)
                    setDiagramUrl(null);
                  }}
                />
              </div>
            )}

            {/* MCQ - Multiple Choice Question */}
            {card_data.cfu.type === "mcq" && card_data.cfu.options && (
              <div className="space-y-4">
                <StemRenderer
                  stem={card_data.cfu.stem}
                  className="text-base font-medium mb-3"
                />
                <RadioGroup
                  value={selectedMCQOption}
                  onValueChange={setSelectedMCQOption}
                  className="space-y-3"
                >
                  {card_data.cfu.options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <RadioGroupItem
                        value={option}
                        id={`option-${index}`}
                      />
                      <Label
                        htmlFor={`option-${index}`}
                        className="text-base cursor-pointer flex-1 p-2 rounded hover:bg-gray-50"
                      >
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                {/* Drawing Support for MCQ */}
                <Button
                  variant="outline"
                  onClick={() => setShowDrawModal(true)}
                  className="w-full mt-4"
                >
                  🎨 Add Diagram to Explain Answer (Optional)
                </Button>
                {(() => {
                  console.log('🎨 RENDER [MCQ] - Drawing block evaluating:', {
                    hasStudentDrawing: !!studentDrawing,
                    studentDrawingValue: studentDrawing,
                    isStoragePreview: studentDrawing?.startsWith('storage_preview:')
                  });

                  if (!studentDrawing) {
                    console.log('⚠️ RENDER [MCQ] - No studentDrawing, skipping render');
                    return null;
                  }

                  console.log('✅ RENDER [MCQ] - Rendering drawing display block');

                  return (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                      {(() => {
                        const isStoragePreview = studentDrawing.startsWith('storage_preview:');
                        console.log('🎨 RENDER [MCQ] - Inner conditional:', { isStoragePreview });

                        if (isStoragePreview) {
                          const imageUrl = studentDrawing.replace('storage_preview:', '');
                          console.log('📷 RENDER [MCQ] - Rendering storage preview with URL:', imageUrl);

                          return (
                            <div className="space-y-2">
                              <div>📷 Previous drawing from last attempt (for reference):</div>
                              <img
                                src={imageUrl}
                                alt="Previous drawing"
                                className="max-w-full h-auto max-h-32 rounded border border-green-300"
                                onLoad={() => console.log('✅ RENDER [MCQ] - Image loaded successfully:', imageUrl)}
                                onError={(e) => console.error('❌ RENDER [MCQ] - Image failed to load:', imageUrl, e)}
                              />
                              <div className="text-xs text-green-600">Click "Add Diagram" to create a new drawing based on this</div>
                            </div>
                          );
                        } else {
                          console.log('✏️ RENDER [MCQ] - Rendering diagram attached message');
                          return <>✓ Diagram attached{studentDrawingText && `: "${studentDrawingText.substring(0, 50)}..."`}</>;
                        }
                      })()}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Numeric Question */}
            {card_data.cfu.type === "numeric" && (
              <div className="space-y-4">
                <Label htmlFor="numeric-answer" className="text-base font-medium">
                  <StemRenderer stem={card_data.cfu.stem} />
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="numeric-answer"
                    type="number"
                    value={studentAnswer}
                    onChange={(e) => setStudentAnswer(e.target.value)}
                    placeholder={card_data.cfu.money2dp ? "0.00" : "Enter number"}
                    className="text-base flex-1"
                    step={card_data.cfu.money2dp ? "0.01" : "any"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSubmitAnswer();
                      }
                    }}
                  />
                </div>

                {/* Drawing Support for Numeric */}
                <Button
                  variant="outline"
                  onClick={() => setShowDrawModal(true)}
                  className="w-full mt-2"
                >
                  🎨 Add Diagram / Working (Optional)
                </Button>
                {(() => {
                  console.log('🎨 RENDER [NUMERIC] - Drawing block evaluating:', {
                    hasStudentDrawing: !!studentDrawing,
                    studentDrawingValue: studentDrawing,
                    isStoragePreview: studentDrawing?.startsWith('storage_preview:')
                  });

                  if (!studentDrawing) {
                    console.log('⚠️ RENDER [NUMERIC] - No studentDrawing, skipping render');
                    return null;
                  }

                  console.log('✅ RENDER [NUMERIC] - Rendering drawing display block');

                  return (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                      {(() => {
                        const isStoragePreview = studentDrawing.startsWith('storage_preview:');
                        console.log('🎨 RENDER [NUMERIC] - Inner conditional:', { isStoragePreview });

                        if (isStoragePreview) {
                          const imageUrl = studentDrawing.replace('storage_preview:', '');
                          console.log('📷 RENDER [NUMERIC] - Rendering storage preview with URL:', imageUrl);

                          return (
                            <div className="space-y-2">
                              <div>📷 Previous drawing from last attempt (for reference):</div>
                              <img
                                src={imageUrl}
                                alt="Previous drawing"
                                className="max-w-full h-auto max-h-32 rounded border border-green-300"
                                onLoad={() => console.log('✅ RENDER [NUMERIC] - Image loaded successfully:', imageUrl)}
                                onError={(e) => console.error('❌ RENDER [NUMERIC] - Image failed to load:', imageUrl, e)}
                              />
                              <div className="text-xs text-green-600">Click "Add Diagram" to create a new drawing based on this</div>
                            </div>
                          );
                        } else {
                          console.log('✏️ RENDER [NUMERIC] - Rendering diagram attached message');
                          return <>✓ Diagram attached{studentDrawingText && `: "${studentDrawingText.substring(0, 50)}..."`}</>;
                        }
                      })()}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Structured Response - Multi-part Written Answer with Rich Text */}
            {card_data.cfu.type === "structured_response" && (
              <div className="space-y-4">
                <Label htmlFor="structured-answer" className="text-base font-medium">
                  <StemRenderer stem={card_data.cfu.stem} />
                </Label>

                {/* Editable diagram hint */}
                {studentAnswer.includes('data-scene') && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                    <span className="text-blue-600 text-sm">✏️</span>
                    <div className="flex-1">
                      <p className="text-sm text-blue-800 font-medium">Your diagrams are editable!</p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        Click any diagram in your answer below to edit it. Changes will be saved automatically.
                      </p>
                    </div>
                  </div>
                )}

                {/* Edit Previous Answer button (Issue 2: restore previous attempt) */}
                {currentCard?.previous_answer &&
                 studentAnswer !== currentCard.previous_answer && (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-2">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-yellow-600 text-sm">🔄</span>
                      <div className="flex-1">
                        <p className="text-sm text-yellow-900 font-medium">Previous answer available</p>
                        <p className="text-xs text-yellow-800 mt-0.5">
                          You can restore your previous answer and edit it instead of starting from scratch.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Restore previous answer HTML (includes any diagrams with scene data)
                        if (currentCard.previous_answer) {
                          setStudentAnswer(currentCard.previous_answer);
                          console.log('📥 Restored previous answer to editor');
                        }
                      }}
                      className="w-full bg-yellow-100 hover:bg-yellow-200 border-yellow-400 text-yellow-900"
                    >
                      📝 Restore Previous Answer
                    </Button>
                  </div>
                )}

                <RichTextEditor
                  value={studentAnswer}
                  onChange={setStudentAnswer}
                  placeholder="Show your working for each part. Use the toolbar for formatting or click the formula button (Σ) to insert equations."
                  className="min-h-[200px]"
                  stem={card_data.cfu.stem}
                />

                {/* Display previous drawing if available (prepopulation) */}
                {studentDrawing && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                    {(() => {
                      const isStoragePreview = studentDrawing.startsWith('storage_preview:');

                      if (isStoragePreview) {
                        const imageUrl = studentDrawing.replace('storage_preview:', '');

                        return (
                          <div className="space-y-2">
                            <div>📷 Previous drawing from last attempt (for reference):</div>
                            <img
                              src={imageUrl}
                              alt="Previous drawing"
                              className="max-w-full h-auto max-h-32 rounded border border-green-300"
                            />
                            <div className="text-xs text-green-600">Use the draw button (✏️) in the editor to create a new drawing based on this</div>
                          </div>
                        );
                      } else {
                        return <>✓ Diagram attached{studentDrawingText && `: "${studentDrawingText.substring(0, 50)}..."`}</>;
                      }
                    })()}
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  💡 Tip: Use <strong>bold/italic</strong> for emphasis, bullet points for lists, the formula button (Σ) for math, and the draw button (✏️) for diagrams
                  <br />
                  Max points: {card_data.cfu.rubric.total_points}
                </p>
              </div>
            )}

            {/* Short Text Question */}
            {card_data.cfu.type === "short_text" && (
              <div className="space-y-4">
                <Label htmlFor="short-text-answer" className="text-base font-medium">
                  <StemRenderer stem={card_data.cfu.stem} />
                </Label>
                <Input
                  id="short-text-answer"
                  value={studentAnswer}
                  onChange={(e) => setStudentAnswer(e.target.value)}
                  placeholder="Brief answer (1-2 sentences)"
                  maxLength={200}
                  className="text-base"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitAnswer();
                    }
                  }}
                />

                {/* Drawing Support for Short Text */}
                <Button
                  variant="outline"
                  onClick={() => setShowDrawModal(true)}
                  className="w-full mt-2"
                >
                  🎨 Add Diagram (Optional)
                </Button>
                {(() => {
                  console.log('🎨 RENDER [SHORT_TEXT] - Drawing block evaluating:', {
                    hasStudentDrawing: !!studentDrawing,
                    studentDrawingValue: studentDrawing,
                    isStoragePreview: studentDrawing?.startsWith('storage_preview:')
                  });

                  if (!studentDrawing) {
                    console.log('⚠️ RENDER [SHORT_TEXT] - No studentDrawing, skipping render');
                    return null;
                  }

                  console.log('✅ RENDER [SHORT_TEXT] - Rendering drawing display block');

                  return (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                      {(() => {
                        const isStoragePreview = studentDrawing.startsWith('storage_preview:');
                        console.log('🎨 RENDER [SHORT_TEXT] - Inner conditional:', { isStoragePreview });

                        if (isStoragePreview) {
                          const imageUrl = studentDrawing.replace('storage_preview:', '');
                          console.log('📷 RENDER [SHORT_TEXT] - Rendering storage preview with URL:', imageUrl);

                          return (
                            <div className="space-y-2">
                              <div>📷 Previous drawing from last attempt (for reference):</div>
                              <img
                                src={imageUrl}
                                alt="Previous drawing"
                                className="max-w-full h-auto max-h-32 rounded border border-green-300"
                                onLoad={() => console.log('✅ RENDER [SHORT_TEXT] - Image loaded successfully:', imageUrl)}
                                onError={(e) => console.error('❌ RENDER [SHORT_TEXT] - Image failed to load:', imageUrl, e)}
                              />
                              <div className="text-xs text-green-600">Click "Add Diagram" to create a new drawing based on this</div>
                            </div>
                          );
                        } else {
                          console.log('✏️ RENDER [SHORT_TEXT] - Rendering diagram attached message');
                          return <>✓ Diagram attached{studentDrawingText && `: "${studentDrawingText.substring(0, 50)}..."`}</>;
                        }
                      })()}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Progressive Hints - for numeric CFU */}
            {card_data.cfu.type === "numeric" && card_data.cfu.hints && card_data.cfu.hints.length > 0 && (
              <div className="mt-4 space-y-2">
                {!showHint ? (
                  <Button
                    variant="secondary"
                    onClick={() => setShowHint(true)}
                    className="w-full"
                  >
                    💡 Show Hint ({hintIndex + 1}/{card_data.cfu.hints.length})
                  </Button>
                ) : (
                  <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                    <h4 className="font-medium text-yellow-800 mb-1">Hint {hintIndex + 1}:</h4>
                    <p className="text-sm text-yellow-700 mb-2">
                      {card_data.cfu.hints[hintIndex]}
                    </p>
                    {hintIndex < card_data.cfu.hints.length - 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHintIndex(hintIndex + 1)}
                        className="text-xs"
                      >
                        Next Hint →
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Misconceptions - Common Student Errors */}
            {card_data.misconceptions && card_data.misconceptions.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 border-l-4 border-amber-400 rounded">
                <h4 className="font-medium text-amber-800 mb-2">⚠️ Common Mistakes to Avoid:</h4>
                <ul className="text-sm text-amber-700 space-y-1">
                  {card_data.misconceptions.slice(0, 2).map((misc, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span>•</span>
                      <span>{misc.misconception}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Action buttons - Hidden in replay mode */}
          {!isReplayMode && (
            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={handleSubmitAnswer}
                disabled={(!studentAnswer.trim() && !selectedMCQOption) || isUploadingDrawing}
                className="w-full"
              >
                {isUploadingDrawing ? "Uploading drawing..." : "Submit Answer"}
              </Button>
            </div>
          )}

          {/* Replay mode notice */}
          {isReplayMode && (
            <div className="pt-4 border-t">
              <div className="bg-gray-100 rounded-lg p-3 text-center">
                <p className="text-sm text-gray-600 italic">
                  🎬 Replay Mode - This lesson card is from a completed session
                </p>
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Universal Drawing Modal - available for all CFU types */}
      {showDrawModal && (
        <DrawingModal
          open={showDrawModal}
          onClose={() => setShowDrawModal(false)}
          onInsert={(base64, sceneData) => {
            // ═══════════════════════════════════════════════════════════════
            // 🎨 DRAWING INSERTED - Critical Event #1
            // ═══════════════════════════════════════════════════════════════
            console.group('%c🎨 DRAWING INSERTED', 'color: #10B981; font-weight: bold; font-size: 14px;');
            console.log('%c✅ Base64:', 'color: #059669;', base64 ? `${(base64.length / 1024).toFixed(1)}KB` : '❌ MISSING');
            console.log('%c✅ Scene Data:', 'color: #059669;', sceneData ? 'CAPTURED' : '❌ MISSING');
            if (sceneData) {
              console.log('%c   └─ Elements:', 'color: #6B7280;', sceneData.elements?.length || 0);
              console.log('%c   └─ Files:', 'color: #6B7280;', Object.keys(sceneData.files || {}).length);
            }
            console.groupEnd();
            // ═══════════════════════════════════════════════════════════════

            setStudentDrawing(base64);
            setStudentDrawingSceneData(sceneData);
            setShowDrawModal(false);
          }}
          stem={card_data.cfu.stem}
          initialSceneData={studentDrawingSceneData} // Pass scene data for editable restoration
        />
      )}
      </>
    );
  },
});