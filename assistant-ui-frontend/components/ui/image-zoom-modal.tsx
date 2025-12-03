"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { Button } from "./button";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  X,
  Expand
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface ImageData {
  url: string;
  title: string;
  type?: string;
}

interface ImageZoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: ImageData[];
  initialIndex?: number;
}

/**
 * Zoom control buttons - must be used inside TransformWrapper context
 */
function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-full px-3 py-2 sm:flex hidden">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => zoomOut()}
        className="text-white hover:bg-white/20 h-8 w-8 p-0"
        aria-label="Zoom out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => resetTransform()}
        className="text-white hover:bg-white/20 h-8 w-8 p-0"
        aria-label="Reset zoom"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => zoomIn()}
        className="text-white hover:bg-white/20 h-8 w-8 p-0"
        aria-label="Zoom in"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * ImageZoomModal - Expandable image viewer with zoom and carousel support
 *
 * Features:
 * - Mouse wheel zoom (desktop)
 * - Pinch-to-zoom (mobile/tablet)
 * - Click-and-drag pan when zoomed
 * - Double-click/tap to reset zoom
 * - Carousel navigation for multiple images
 * - Keyboard controls (ESC, arrows, +/-)
 * - Responsive design (fullscreen on mobile)
 */
export function ImageZoomModal({
  open,
  onOpenChange,
  images,
  initialIndex = 0
}: ImageZoomModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [transformKey, setTransformKey] = useState(0);

  // Reset to initial index when modal opens
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setTransformKey(prev => prev + 1); // Reset zoom state
    }
  }, [open, initialIndex]);

  // Reset zoom when navigating to different image
  useEffect(() => {
    setTransformKey(prev => prev + 1);
  }, [currentIndex]);

  // Navigation handlers
  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          goToPrevious();
          break;
        case "ArrowRight":
          e.preventDefault();
          goToNext();
          break;
        case "+":
        case "=":
          // Zoom in handled by TransformWrapper
          break;
        case "-":
          // Zoom out handled by TransformWrapper
          break;
        case "0":
          // Reset zoom - trigger re-render
          setTransformKey(prev => prev + 1);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, goToPrevious, goToNext]);

  // Guard against empty images array
  if (images.length === 0) return null;

  const currentImage = images[currentIndex];
  const hasMultipleImages = images.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Base styles - full coverage
          "p-0 gap-0 overflow-hidden bg-black/95 border-0",
          // Mobile: fullscreen
          "w-screen h-screen max-w-none rounded-none",
          // Desktop: near-fullscreen with some margin
          "sm:w-[95vw] sm:h-[90vh] sm:max-w-[95vw] sm:rounded-lg"
        )}
        showCloseButton={false}
      >
        {/* Accessible title (hidden visually) */}
        <VisuallyHidden asChild>
          <DialogTitle>{currentImage.title}</DialogTitle>
        </VisuallyHidden>

        {/* Header with title and close button */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-3 text-white">
            <span className="font-medium text-sm sm:text-base truncate max-w-[200px] sm:max-w-none">
              {currentImage.title}
            </span>
            {currentImage.type && (
              <span className="text-xs px-2 py-0.5 bg-white/20 rounded hidden sm:inline">
                {currentImage.type}
              </span>
            )}
            {hasMultipleImages && (
              <span className="text-xs text-white/70">
                {currentIndex + 1} / {images.length}
              </span>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-white hover:bg-white/20 h-8 w-8 p-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Main zoom container */}
        <TransformWrapper
          key={transformKey}
          initialScale={1}
          minScale={0.5}
          maxScale={5}
          wheel={{ step: 0.1 }}
          doubleClick={{ mode: "reset" }}
          panning={{ velocityDisabled: true }}
          centerOnInit={true}
        >
          <ZoomControls />
          <TransformComponent
            wrapperClass="!w-full !h-full"
            contentClass="!w-full !h-full flex items-center justify-center"
          >
            <img
              src={currentImage.url}
              alt={currentImage.title}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
              onError={(e) => {
                console.error("Failed to load image:", currentImage.url);
                // Could set a fallback image here
              }}
            />
          </TransformComponent>
        </TransformWrapper>

        {/* Carousel navigation */}
        {hasMultipleImages && (
          <>
            {/* Previous button */}
            <Button
              variant="ghost"
              size="lg"
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 text-white hover:bg-white/20 h-12 w-12 p-0 rounded-full bg-black/30"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>

            {/* Next button */}
            <Button
              variant="ghost"
              size="lg"
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 text-white hover:bg-white/20 h-12 w-12 p-0 rounded-full bg-black/30"
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>

            {/* Dot indicators */}
            <div className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    index === currentIndex
                      ? "bg-white w-4"
                      : "bg-white/50 hover:bg-white/70"
                  )}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Mobile gesture hint (shown briefly) */}
        <MobileGestureHint />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Brief hint for mobile users about available gestures
 */
function MobileGestureHint() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 sm:hidden">
      <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-2 text-white text-xs text-center animate-pulse">
        Pinch to zoom • Double-tap to reset
      </div>
    </div>
  );
}

/**
 * Clickable image wrapper that opens the zoom modal
 * Use this to wrap images that should be expandable
 */
interface ExpandableImageProps {
  src: string;
  alt: string;
  title?: string;
  type?: string;
  className?: string;
  containerClassName?: string;
}

export function ExpandableImage({
  src,
  alt,
  title,
  type,
  className,
  containerClassName
}: ExpandableImageProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          "relative group cursor-zoom-in",
          containerClassName
        )}
        onClick={() => setModalOpen(true)}
      >
        <img
          src={src}
          alt={alt}
          className={cn("transition-transform", className)}
        />
        {/* Expand overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white px-3 py-1.5 rounded-full flex items-center gap-1.5 text-sm">
            <Expand className="h-4 w-4" />
            <span className="hidden sm:inline">Click to expand</span>
          </div>
        </div>
      </div>

      <ImageZoomModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        images={[{ url: src, title: title || alt, type }]}
        initialIndex={0}
      />
    </>
  );
}
