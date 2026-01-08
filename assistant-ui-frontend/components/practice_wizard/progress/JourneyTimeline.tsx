"use client";

/**
 * JourneyTimeline - Metro-map style vertical timeline for progress tracking
 *
 * Desktop: Always-visible left sidebar showing all blocks as connected stops
 * Mobile: Collapsible bottom sheet with floating toggle button
 *
 * Features:
 * - Vertical connecting line between stops
 * - Color-coded block markers (golden/complete/current/locked)
 * - Expanded details for current block
 * - Mastery breakdown panel at bottom
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, ChevronUp, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ProgressReport,
  ConceptBlock,
} from "@/hooks/practice/useLangGraphWizard";
import { BlockStopMarker, type CompletedBlockDetails } from "./BlockStopMarker";

interface JourneyTimelineProps {
  progress: ProgressReport;
  currentBlock: ConceptBlock | null;
  cumulativeMastery: number;
  hardQuestionsAttempted: number;
  questionsAnswered: number;
  questionsCorrect: number;
  currentDifficulty: "easy" | "medium" | "hard";
  /** Map of block_id to block title for displaying titles on all blocks */
  blockTitles?: Record<string, string>;
  /** Map of block_id to detailed completion stats for finished blocks */
  completedBlocksDetails?: Record<string, CompletedBlockDetails>;
  className?: string;
}

// Hook to detect mobile viewport
function useIsMobile(breakpoint: number = 1024) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    // Check on mount
    checkMobile();

    // Listen for resize
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [breakpoint]);

  return isMobile;
}

// Timeline content (shared between desktop and mobile)
function JourneyTimelineContent({
  progress,
  currentBlock,
  cumulativeMastery,
  hardQuestionsAttempted,
  questionsAnswered,
  questionsCorrect,
  currentDifficulty,
  blockTitles,
  completedBlocksDetails,
}: JourneyTimelineProps) {
  const { blocks, current_block_index } = progress;
  const completedBlocks = blocks.filter((b) => b.is_complete).length;

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200/50">
          <MapPin className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-gray-800 text-sm">Learning Journey</h2>
          <p className="text-[11px] text-gray-500">
            {completedBlocks} of {blocks.length} blocks complete
          </p>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-[10px] mb-1.5">
          <span className="text-gray-500 font-medium">Overall Progress</span>
          <span className="text-violet-600 font-semibold tabular-nums">
            {Math.round((completedBlocks / blocks.length) * 100)}%
          </span>
        </div>
        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${(completedBlocks / blocks.length) * 100}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
          {/* Block markers */}
          <div className="absolute inset-0 flex">
            {blocks.slice(0, -1).map((_, index) => (
              <div
                key={index}
                className="flex-1 border-r border-white/50"
              />
            ))}
            <div className="flex-1" />
          </div>
        </div>
      </div>

      {/* Timeline with vertical line */}
      <div className="relative">
        {/* Vertical connecting line */}
        <div className="absolute left-[9px] top-0 bottom-0 w-0.5 bg-gray-200" />

        {/* Block stops */}
        <div className="space-y-1">
          {blocks.map((block, index) => {
            const isCurrent = index === current_block_index;
            const isLocked = index > current_block_index && !block.is_complete;

            return (
              <BlockStopMarker
                key={block.block_id}
                block={block}
                index={index}
                isCurrent={isCurrent}
                isLocked={isLocked}
                blockTitle={
                  blockTitles?.[block.block_id] ??
                  (isCurrent ? currentBlock?.title : undefined)
                }
                currentDetails={
                  isCurrent
                    ? {
                        cumulativeMastery,
                        hardQuestionsAttempted,
                        questionsAnswered,
                        questionsCorrect,
                        currentDifficulty,
                      }
                    : undefined
                }
                completedDetails={
                  block.is_complete && !isCurrent
                    ? completedBlocksDetails?.[block.block_id]
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

// Desktop sidebar version
function JourneyTimelineDesktop(props: JourneyTimelineProps) {
  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col w-72 flex-shrink-0",
        "border-r border-gray-100 bg-white/80 backdrop-blur-sm",
        "overflow-y-auto",
        props.className
      )}
    >
      <div className="p-4 sticky top-0">
        <JourneyTimelineContent {...props} />
      </div>
    </aside>
  );
}

// Mobile bottom sheet version
function JourneyTimelineMobile(props: JourneyTimelineProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating toggle button - fixed bottom left */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-4 left-4 z-30 lg:hidden",
          "px-4 py-2.5 rounded-full shadow-lg",
          "flex items-center gap-2",
          "transition-colors duration-200",
          isOpen
            ? "bg-violet-600 text-white"
            : "bg-white text-violet-600 border border-violet-200"
        )}
        whileTap={{ scale: 0.95 }}
      >
        <GraduationCap className="w-4 h-4" />
        <span className="text-sm font-semibold">Journey</span>
        <ChevronUp
          className={cn(
            "w-4 h-4 transition-transform duration-300",
            isOpen && "rotate-180"
          )}
        />
      </motion.button>

      {/* Bottom sheet */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setIsOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={cn(
                "fixed bottom-0 left-0 right-0 z-50 lg:hidden",
                "bg-white rounded-t-2xl shadow-xl",
                "max-h-[75vh] overflow-hidden flex flex-col"
              )}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-4 pb-6">
                <JourneyTimelineContent {...props} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// Main component that renders appropriate version
export function JourneyTimeline(props: JourneyTimelineProps) {
  const isMobile = useIsMobile();

  return (
    <>
      {/* Desktop: inline sidebar */}
      <JourneyTimelineDesktop {...props} />

      {/* Mobile: floating button + bottom sheet */}
      {isMobile && <JourneyTimelineMobile {...props} />}
    </>
  );
}

export default JourneyTimeline;
