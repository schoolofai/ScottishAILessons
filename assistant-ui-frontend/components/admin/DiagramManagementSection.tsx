"use client"

import * as React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { DiagramDriver } from "@/lib/appwrite/driver/DiagramDriver"
import { LessonDiagram } from "@/lib/appwrite/types"
import { validateImageFile, fileToBase64 } from "@/lib/utils/imageUpload"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Upload, Trash2, Info, ImageIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface DiagramManagementSectionProps {
  lessonTemplateId: string;
  cardId: string;
}

/**
 * Diagram Management Section for Admin Card Editor
 *
 * Displays and manages both lesson and CFU diagrams in a vertical stack layout.
 * Provides functionality to:
 * - View existing diagrams with metadata
 * - Upload custom diagram images
 * - Delete diagrams with confirmation
 * - Display quality metrics
 */
export function DiagramManagementSection({
  lessonTemplateId,
  cardId
}: DiagramManagementSectionProps) {
  const { toast } = useToast();
  const [lessonDiagram, setLessonDiagram] = useState<LessonDiagram | null>(null);
  const [cfuDiagram, setCfuDiagram] = useState<LessonDiagram | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingContext, setUploadingContext] = useState<'lesson' | 'cfu' | null>(null);
  const [deletingContext, setDeletingContext] = useState<'lesson' | 'cfu' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteContext, setPendingDeleteContext] = useState<'lesson' | 'cfu' | null>(null);

  const diagramDriver = new DiagramDriver();

  // Fetch diagrams on mount and when lessonTemplateId or cardId changes
  const fetchDiagrams = useCallback(async () => {
    setLoading(true);
    try {
      const diagrams = await diagramDriver.getDiagramsForCard(lessonTemplateId, cardId);
      setLessonDiagram(diagrams.lesson);
      setCfuDiagram(diagrams.cfu);
    } catch (error: any) {
      console.error('Failed to fetch diagrams:', error);
      toast({
        title: "Error Loading Diagrams",
        description: error.message || "Failed to load diagrams. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [lessonTemplateId, cardId]);

  useEffect(() => {
    fetchDiagrams();
  }, [fetchDiagrams]);

  // Handle file upload
  const handleUpload = async (file: File, context: 'lesson' | 'cfu') => {
    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast({
        title: "Invalid File",
        description: validation.error,
        variant: "destructive"
      });
      return;
    }

    setUploadingContext(context);
    try {
      // Convert to base64
      const base64 = await fileToBase64(file);

      // Upload diagram
      const uploadedDiagram = await diagramDriver.uploadDiagram(
        lessonTemplateId,
        cardId,
        context,
        base64
      );

      // Update state
      if (context === 'lesson') {
        setLessonDiagram(uploadedDiagram);
      } else {
        setCfuDiagram(uploadedDiagram);
      }

      toast({
        title: "Upload Successful",
        description: `${context === 'lesson' ? 'Lesson' : 'CFU'} diagram uploaded successfully.`
      });
    } catch (error: any) {
      console.error('Upload failed:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload diagram. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploadingContext(null);
    }
  };

  // Handle delete initiation
  const initiateDelete = (context: 'lesson' | 'cfu') => {
    setPendingDeleteContext(context);
    setShowDeleteConfirm(true);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!pendingDeleteContext) return;

    setDeletingContext(pendingDeleteContext);
    try {
      await diagramDriver.deleteDiagram(lessonTemplateId, cardId, pendingDeleteContext);

      // Update state
      if (pendingDeleteContext === 'lesson') {
        setLessonDiagram(null);
      } else {
        setCfuDiagram(null);
      }

      toast({
        title: "Diagram Deleted",
        description: `${pendingDeleteContext === 'lesson' ? 'Lesson' : 'CFU'} diagram deleted successfully.`
      });
    } catch (error: any) {
      console.error('Delete failed:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete diagram. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDeletingContext(null);
      setPendingDeleteContext(null);
      setShowDeleteConfirm(false);
    }
  };

  // Handle delete cancellation
  const handleDeleteCancel = () => {
    setPendingDeleteContext(null);
    setShowDeleteConfirm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-3 text-gray-600">Loading diagrams...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Diagram Management</h3>
        <Badge variant="outline">Card: {cardId}</Badge>
      </div>

      {/* Lesson Context Diagram */}
      <DiagramCard
        title="Lesson Context Diagram"
        context="lesson"
        diagram={lessonDiagram}
        uploading={uploadingContext === 'lesson'}
        deleting={deletingContext === 'lesson'}
        onUpload={(file) => handleUpload(file, 'lesson')}
        onDelete={() => initiateDelete('lesson')}
        diagramDriver={diagramDriver}
      />

      {/* CFU Context Diagram */}
      <DiagramCard
        title="CFU Context Diagram"
        context="cfu"
        diagram={cfuDiagram}
        uploading={uploadingContext === 'cfu'}
        deleting={deletingContext === 'cfu'}
        onUpload={(file) => handleUpload(file, 'cfu')}
        onDelete={() => initiateDelete('cfu')}
        diagramDriver={diagramDriver}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Diagram"
        message={`Are you sure you want to delete the ${pendingDeleteContext === 'lesson' ? 'Lesson' : 'CFU'} diagram? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="destructive"
        loading={deletingContext !== null}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}

/**
 * DiagramCard Component
 *
 * Displays a single diagram (lesson or CFU context) with:
 * - Image preview
 * - Metadata (type, quality score, iterations)
 * - Upload/Replace functionality
 * - Delete functionality
 */
interface DiagramCardProps {
  title: string;
  context: 'lesson' | 'cfu';
  diagram: LessonDiagram | null;
  uploading: boolean;
  deleting: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
  diagramDriver: DiagramDriver;
}

function DiagramCard({
  title,
  context,
  diagram,
  uploading,
  deleting,
  onUpload,
  onDelete,
  diagramDriver
}: DiagramCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onUpload(file);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  if (!diagram) {
    // No diagram - show upload zone
    return (
      <Card className="p-6">
        <h4 className="text-md font-semibold mb-4">{title}</h4>
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
          onClick={triggerFileInput}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
          {uploading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
              <p className="text-sm text-gray-600">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">
                Click to upload diagram
              </p>
              <p className="text-xs text-gray-500">
                PNG or JPG (max 5MB)
              </p>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Diagram exists - show preview and actions
  const previewUrl = diagramDriver.getStoragePreviewUrl(diagram.image_file_id);

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <h4 className="text-md font-semibold">{title}</h4>
          {diagram.visual_critique_score !== null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="cursor-help">
                  <Info className="h-3 w-3 mr-1" />
                  Score: {diagram.visual_critique_score?.toFixed(2)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Quality Score: {diagram.visual_critique_score?.toFixed(2)}</p>
                <p>Iterations: {diagram.critique_iterations}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <Badge variant="outline">{diagram.diagram_type}</Badge>
      </div>

      {/* Image Preview */}
      <div className="mb-4 rounded-lg overflow-hidden border border-gray-200">
        <img
          src={previewUrl}
          alt={title}
          className="w-full h-auto"
          onError={(e) => {
            e.currentTarget.src = '/placeholder-diagram.png';
          }}
        />
      </div>

      {/* Metadata */}
      {diagram.critique_feedback && diagram.critique_feedback !== 'Custom uploaded image' && (
        <div className="mb-4 text-xs text-gray-600 bg-gray-50 p-3 rounded-md">
          <p className="font-semibold mb-1">Generation Feedback:</p>
          <p className="line-clamp-2">{diagram.critique_feedback}</p>
        </div>
      )}

      {diagram.critique_feedback === 'Custom uploaded image' && (
        <div className="mb-4 text-xs text-blue-600 bg-blue-50 p-3 rounded-md flex items-center">
          <ImageIcon className="h-4 w-4 mr-2" />
          <span>Custom uploaded image</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading || deleting}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={triggerFileInput}
          disabled={uploading || deleting}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? 'Uploading...' : 'Replace'}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={uploading || deleting}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </div>
    </Card>
  );
}
