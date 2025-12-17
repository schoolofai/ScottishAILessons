"use client";

/**
 * BlockReferencePanel - Right-side drawer showing block explanatory content
 *
 * Displays the current block's explanation, worked example, key formulas,
 * and common misconceptions while students practice questions.
 * Uses the same design system as ConceptStep and WizardSidePanel.
 *
 * Features:
 * - Expandable width (320px ↔ 480px)
 * - Drag-to-resize functionality
 * - Block navigation arrows
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  BookOpen,
  Lightbulb,
  Sparkles,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  Maximize2,
  Minimize2,
  GripVertical,
} from "lucide-react";
import type { ParsedBlockContent, BlockProgress } from "@/types/practice-wizard-contracts";
import type { PracticeBlock } from "@/lib/appwrite/driver/PracticeQuestionDriver";

interface BlockReferencePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  currentContent: ParsedBlockContent | null;
  upcomingContent: ParsedBlockContent[];
  isLoading: boolean;
  error: Error | null;
  /** Progress data for all blocks */
  blockProgress?: BlockProgress[];
  /** Current block ID being practiced */
  currentBlockId?: string;
  /** Callback when user wants to view a different block */
  onBlockSelect?: (blockId: string) => void;

  // ═══════════════════════════════════════════════════════════════════════════
  // Navigation Props (Phase 6)
  // ═══════════════════════════════════════════════════════════════════════════

  /** All blocks available for navigation (lightweight metadata) */
  allBlocks?: PracticeBlock[];
  /** Current viewing index in navigation */
  viewingIndex?: number;
  /** Navigate to previous block */
  onNavigateBack?: () => void;
  /** Navigate to next block */
  onNavigateForward?: () => void;
  /** Whether user can navigate back */
  canGoBack?: boolean;
  /** Whether user can navigate forward */
  canGoForward?: boolean;

  // ═══════════════════════════════════════════════════════════════════════════
  // Resize Props (Phase 7) - Drag-to-resize functionality
  // ═══════════════════════════════════════════════════════════════════════════

  /** Current panel width (controlled from parent) */
  width?: number;
  /** Callback when width changes during resize */
  onWidthChange?: (width: number) => void;
  /** Minimum panel width */
  minWidth?: number;
  /** Maximum panel width */
  maxWidth?: number;
  /** Whether panel is in docked mode (not overlay) */
  isDocked?: boolean;
}

/**
 * Expandable section component - matches ConceptStep patterns
 */
function ExpandableSection({
  icon,
  iconColorClass,
  title,
  count,
  defaultExpanded = false,
  children,
}: {
  icon: React.ReactNode;
  iconColorClass: string;
  title: string;
  count?: number;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-3 px-1 hover:bg-gray-50/50 transition-colors text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <span className={iconColorClass}>{icon}</span>
          <span className="font-semibold text-gray-700 text-sm">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-500 rounded">
              {count}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pb-4 px-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


export function BlockReferencePanel({
  isOpen,
  onToggle,
  currentContent,
  upcomingContent,
  isLoading,
  error,
  blockProgress = [],
  currentBlockId,
  onBlockSelect,
  // Navigation props (Phase 6)
  allBlocks: navBlocks = [],
  viewingIndex = 0,
  onNavigateBack,
  onNavigateForward,
  canGoBack = false,
  canGoForward = false,
  // Resize props (Phase 7)
  width: controlledWidth,
  onWidthChange,
  minWidth = 280,
  maxWidth = 600,
  isDocked = false,
}: BlockReferencePanelProps) {
  // Derive expanded state from controlled width (expanded = at or near max width)
  const isExpanded = controlledWidth ? controlledWidth >= maxWidth * 0.9 : false;

  // Handle expand/collapse toggle - actually changes width
  const handleExpandToggle = useCallback(() => {
    if (!onWidthChange) return;

    if (isExpanded) {
      // Contract to half of max width (20% of viewport)
      const contractedWidth = Math.max(minWidth, Math.floor(maxWidth / 2));
      onWidthChange(contractedWidth);
    } else {
      // Expand to max width (40% of viewport)
      onWidthChange(maxWidth);
    }
  }, [isExpanded, maxWidth, minWidth, onWidthChange]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Resize State & Handlers (Phase 7)
  // ═══════════════════════════════════════════════════════════════════════════
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // Handle resize movement and end
  useEffect(() => {
    if (!isResizing || !onWidthChange) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate new width based on mouse position from right edge
      const viewportWidth = window.innerWidth;
      const newWidth = viewportWidth - e.clientX;

      // Clamp to min/max
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      onWidthChange(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minWidth, maxWidth, onWidthChange]);

  // Display current content directly (simplified - no block switching)
  const displayedContent = currentContent;

  // Panel width: use controlled width if provided, otherwise fall back to expanded state
  const panelWidth = controlledWidth ?? (isExpanded ? 480 : 320);

  return (
    <>
      {/* Toggle Button - Styled "Open Notes" button when closed, subtle collapse when open */}
      {!isOpen ? (
        // Closed state: Prominent "Open Notes" button
        <button
          onClick={onToggle}
          className={`
            fixed right-4 top-20 z-40
            flex items-center gap-2 px-4 py-2.5
            bg-gradient-to-r from-cyan-500 to-blue-500
            text-white font-semibold text-sm
            rounded-xl shadow-lg shadow-cyan-200/50
            hover:shadow-xl hover:shadow-cyan-300/50 hover:scale-105
            active:scale-95
            transition-all duration-200
          `}
          aria-label="Open reference panel"
        >
          <BookOpen className="w-4 h-4" />
          <span>Open Notes</span>
        </button>
      ) : (
        // Open state: Subtle collapse chevron on edge
        <button
          onClick={onToggle}
          className={`
            fixed right-0 top-1/2 -translate-y-1/2 z-40
            w-6 h-16 flex items-center justify-center
            bg-white/90 backdrop-blur-sm border border-r-0 border-gray-200
            rounded-l-lg shadow-md hover:shadow-lg hover:bg-cyan-50
            transition-all duration-300
          `}
          style={{
            transform: `translateY(-50%) translateX(${-panelWidth}px)`,
          }}
          aria-label="Close reference panel"
        >
          <ChevronRight className="w-4 h-4 text-cyan-500" />
        </button>
      )}

      {/* Backdrop - Mobile only */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>

      {/* Side Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            ref={panelRef}
            initial={{ x: panelWidth }}
            animate={{ x: 0, width: panelWidth }}
            exit={{ x: panelWidth }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 bg-white/95 backdrop-blur-md border-l border-gray-200/80 shadow-xl z-40 overflow-hidden flex flex-col"
            style={{ width: panelWidth }}
          >
            {/* Resize Handle - Left Edge (Phase 7) */}
            {onWidthChange && (
              <div
                onMouseDown={handleResizeStart}
                className={`absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-50
                  transition-all duration-150 group
                  ${isResizing
                    ? 'bg-cyan-500'
                    : 'bg-transparent hover:bg-cyan-400/30'
                  }`}
                aria-label="Resize panel"
              >
                {/* Grip indicator - shows on hover */}
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1
                  transition-opacity ${isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  <GripVertical className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            )}

            {/* Header - matches WizardSidePanel */}
            <div className="p-5 border-b border-gray-100 bg-gradient-to-br from-slate-50 to-white flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-200">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-sm tracking-tight">
                      Reference
                    </h2>
                    <p className="text-[11px] text-gray-500">
                      {isLoading ? "Loading..." : displayedContent ? `Block ${displayedContent.blockIndex + 1}` : "No content"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* Navigation Arrows (Phase 6) */}
                  {navBlocks.length > 1 && (
                    <div className="flex items-center gap-1 mr-2 border-r border-gray-200 pr-2">
                      <button
                        onClick={onNavigateBack}
                        disabled={!canGoBack}
                        className={`p-1.5 rounded-lg transition-colors ${
                          canGoBack
                            ? "hover:bg-cyan-100 text-cyan-600"
                            : "text-gray-300 cursor-not-allowed"
                        }`}
                        aria-label="Previous block"
                        title="Previous block"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-[11px] text-gray-500 min-w-[3.5rem] text-center font-medium">
                        {viewingIndex + 1} of {navBlocks.length}
                      </span>
                      <button
                        onClick={onNavigateForward}
                        disabled={!canGoForward}
                        className={`p-1.5 rounded-lg transition-colors ${
                          canGoForward
                            ? "hover:bg-cyan-100 text-cyan-600"
                            : "text-gray-300 cursor-not-allowed"
                        }`}
                        aria-label="Next block"
                        title="Next block"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {/* Expand/Collapse button */}
                  <button
                    onClick={handleExpandToggle}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    aria-label={isExpanded ? "Collapse panel" : "Expand panel"}
                    title={isExpanded ? "Collapse to 20%" : "Expand to 40%"}
                  >
                    {isExpanded ? (
                      <Minimize2 className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Maximize2 className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  {/* Close button - mobile only */}
                  <button
                    onClick={onToggle}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
                    aria-label="Close panel"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
              {/* Loading State */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-3" />
                  <p className="text-sm">Loading block content...</p>
                </div>
              )}

              {/* Error State */}
              {error && !isLoading && (
                <div className="p-4">
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-700">Failed to load content</p>
                        <p className="text-xs text-red-600 mt-1">{error.message}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Block Content */}
              {displayedContent && !isLoading && !error && (
                <div className="p-4">
                  {/* Block Title Header - Simplified without progress ring */}
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-gray-800">
                      {displayedContent.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Block {displayedContent.blockIndex + 1}</p>
                  </div>

                  {/* Expandable Sections */}
                  <div className="space-y-0">
                    {/* Explanation Section */}
                    <ExpandableSection
                      icon={<Lightbulb className="w-4 h-4" />}
                      iconColorClass="text-amber-500"
                      title="Understanding the Concept"
                      defaultExpanded={true}
                    >
                      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-4 border border-cyan-100">
                        <div className="prose prose-sm max-w-none text-gray-700 text-[13px] leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {displayedContent.explanation}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </ExpandableSection>

                    {/* Worked Example Section */}
                    {displayedContent.worked_example && (
                      <ExpandableSection
                        icon={<Sparkles className="w-4 h-4" />}
                        iconColorClass="text-purple-500"
                        title="Worked Example"
                      >
                        <div className="space-y-3">
                          {/* Problem */}
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                              Problem
                            </p>
                            <div className="prose prose-sm max-w-none text-gray-800 text-[13px]">
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {displayedContent.worked_example.problem}
                              </ReactMarkdown>
                            </div>
                          </div>

                          {/* Solution Steps */}
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                              Solution Steps
                            </p>
                            {displayedContent.worked_example.solution_steps.map((step, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-violet-500 flex items-center justify-center text-white font-bold text-[10px] shadow-sm">
                                  {idx + 1}
                                </div>
                                <div className="flex-1 pt-0.5 prose prose-sm max-w-none text-gray-700 text-[12px]">
                                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {step}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Final Answer */}
                          <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-3 border border-emerald-200 flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">
                                Answer
                              </p>
                              <div className="prose prose-sm max-w-none text-gray-800 text-[13px] font-medium mt-1">
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                  {displayedContent.worked_example.final_answer}
                                </ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        </div>
                      </ExpandableSection>
                    )}

                    {/* Key Formulas Section */}
                    {displayedContent.key_formulas.length > 0 && (
                      <ExpandableSection
                        icon={<Calculator className="w-4 h-4" />}
                        iconColorClass="text-violet-500"
                        title="Key Formulas"
                        count={displayedContent.key_formulas.length}
                      >
                        <div className="flex flex-wrap gap-2">
                          {displayedContent.key_formulas.map((formula, idx) => {
                            // Ensure formula has LaTeX delimiters for remarkMath to parse
                            // If formula doesn't start with $ or \[, wrap it in $$...$$ for display math
                            const hasDelimiters = formula.startsWith('$') || formula.startsWith('\\[') || formula.startsWith('\\(');
                            const wrappedFormula = hasDelimiters ? formula : `$$${formula}$$`;

                            return (
                              <div
                                key={idx}
                                className="px-3 py-2 bg-gradient-to-r from-violet-100 to-purple-100 text-purple-700 rounded-lg text-sm font-medium border border-purple-200"
                              >
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                  {wrappedFormula}
                                </ReactMarkdown>
                              </div>
                            );
                          })}
                        </div>
                      </ExpandableSection>
                    )}

                    {/* Common Mistakes Section */}
                    {displayedContent.common_misconceptions.length > 0 && (
                      <ExpandableSection
                        icon={<AlertTriangle className="w-4 h-4" />}
                        iconColorClass="text-orange-500"
                        title="Watch Out"
                        count={displayedContent.common_misconceptions.length}
                      >
                        <div className="space-y-2">
                          {displayedContent.common_misconceptions.map((misconception, idx) => (
                            <div
                              key={idx}
                              className="bg-orange-50 border border-orange-100 rounded-lg p-3"
                            >
                              <div className="prose prose-sm max-w-none text-orange-900 text-[12px]">
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                  {misconception}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ExpandableSection>
                    )}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!currentContent && !isLoading && !error && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <BookOpen className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm">No block content available</p>
                  <p className="text-xs mt-1">Start practicing to see reference material</p>
                </div>
              )}
            </div>

            {/* Footer Hint */}
            <div className="p-4 border-t border-gray-100 bg-white/80 flex-shrink-0">
              <div className="flex items-start gap-2 text-[11px] text-gray-400">
                <Sparkles className="w-3.5 h-3.5 mt-0.5 text-cyan-400" />
                <p>
                  Use this reference while answering questions. Expand sections for more detail.
                </p>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

export default BlockReferencePanel;
