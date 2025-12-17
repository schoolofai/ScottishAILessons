"use client";

/**
 * WizardSidePanel - Collapsible side drawer showing blocks and concepts
 *
 * Elegant slide-out navigation for viewing all practice blocks,
 * their concepts, and mastery progress. Uses a refined editorial aesthetic.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Star,
  BookOpen,
  Target,
  Lock,
  Sparkles,
} from "lucide-react";
import type { ProgressReport, ConceptBlock } from "@/hooks/practice/useLangGraphWizard";

interface WizardSidePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  progress: ProgressReport | null;
  currentBlock: ConceptBlock | null;
}

export function WizardSidePanel({
  isOpen,
  onToggle,
  progress,
  currentBlock,
}: WizardSidePanelProps) {
  if (!progress) return null;

  const { blocks, current_block_index, overall_mastery } = progress;

  return (
    <>
      {/* Toggle Button - Always visible */}
      <button
        onClick={onToggle}
        className={`
          fixed left-0 top-1/2 -translate-y-1/2 z-40
          w-6 h-16 flex items-center justify-center
          bg-white/90 backdrop-blur-sm border border-l-0 border-gray-200
          rounded-r-lg shadow-md hover:shadow-lg
          transition-all duration-300
          ${isOpen ? "translate-x-72" : "translate-x-0"}
        `}
        aria-label={isOpen ? "Close navigation" : "Open navigation"}
      >
        {isOpen ? (
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {/* Backdrop */}
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
            initial={{ x: -288 }}
            animate={{ x: 0 }}
            exit={{ x: -288 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 w-72 bg-white/95 backdrop-blur-md border-r border-gray-200/80 shadow-xl z-40 overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 border-b border-gray-100 bg-gradient-to-br from-slate-50 to-white">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm tracking-tight">
                    Learning Path
                  </h2>
                  <p className="text-[11px] text-gray-500">
                    {blocks.filter(b => b.is_complete).length} of {blocks.length} complete
                  </p>
                </div>
              </div>

              {/* Overall mastery bar */}
              <div className="relative">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(overall_mastery * 100)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-gray-400">Overall Progress</span>
                  <span className="text-[10px] font-semibold text-violet-600">
                    {Math.round(overall_mastery * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Blocks List */}
            <div className="overflow-y-auto h-[calc(100vh-140px)] py-3">
              <div className="space-y-1 px-3">
                {blocks.map((block, index) => {
                  const isComplete = block.is_complete;
                  const isCurrent = index === current_block_index;
                  const isLocked = index > current_block_index && !isComplete;
                  const isGolden = block.mastery_score >= 0.9;
                  const masteryPct = Math.round(block.mastery_score * 100);

                  return (
                    <motion.div
                      key={block.block_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`
                        relative p-3 rounded-xl transition-all duration-200
                        ${isCurrent
                          ? "bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200 shadow-sm"
                          : isComplete
                          ? "bg-gray-50/50 hover:bg-gray-50"
                          : isLocked
                          ? "opacity-50"
                          : "hover:bg-gray-50"
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status indicator */}
                        <div className={`
                          w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
                          ${isGolden && isComplete
                            ? "bg-gradient-to-br from-amber-400 to-yellow-500 shadow-sm"
                            : isComplete
                            ? "bg-emerald-500"
                            : isCurrent
                            ? "bg-gradient-to-br from-cyan-500 to-blue-500 shadow-sm"
                            : isLocked
                            ? "bg-gray-200"
                            : "bg-gray-100"
                          }
                        `}>
                          {isComplete ? (
                            isGolden ? (
                              <Star className="w-4 h-4 text-white fill-white" />
                            ) : (
                              <Check className="w-4 h-4 text-white" />
                            )
                          ) : isLocked ? (
                            <Lock className="w-3.5 h-3.5 text-gray-400" />
                          ) : isCurrent ? (
                            <Target className="w-4 h-4 text-white" />
                          ) : (
                            <span className="text-xs font-bold text-gray-400">{index + 1}</span>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className={`
                              text-sm font-semibold truncate
                              ${isCurrent ? "text-cyan-700" : isComplete ? "text-gray-700" : "text-gray-600"}
                            `}>
                              Block {index + 1}
                            </h3>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-cyan-500 text-white rounded">
                                Current
                              </span>
                            )}
                          </div>

                          {/* Show current block details */}
                          {isCurrent && currentBlock && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {currentBlock.title}
                            </p>
                          )}

                          {/* Mastery indicator */}
                          {(isComplete || isCurrent) && (
                            <div className="flex items-center gap-2 mt-2">
                              <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isGolden
                                      ? "bg-gradient-to-r from-amber-400 to-yellow-500"
                                      : isComplete
                                      ? "bg-emerald-500"
                                      : "bg-cyan-500"
                                  }`}
                                  style={{ width: `${masteryPct}%` }}
                                />
                              </div>
                              <span className={`text-[10px] font-semibold tabular-nums ${
                                isGolden ? "text-amber-600" : isComplete ? "text-emerald-600" : "text-cyan-600"
                              }`}>
                                {masteryPct}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Current block glow effect */}
                      {isCurrent && (
                        <div className="absolute inset-0 rounded-xl bg-cyan-400/10 animate-pulse pointer-events-none" />
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer hint */}
              <div className="px-6 py-4 mt-4 border-t border-gray-100">
                <div className="flex items-start gap-2 text-[11px] text-gray-400">
                  <Sparkles className="w-3.5 h-3.5 mt-0.5 text-amber-400" />
                  <p>
                    Complete all blocks with 70%+ mastery and 2 hard questions to finish the session.
                  </p>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

export default WizardSidePanel;
