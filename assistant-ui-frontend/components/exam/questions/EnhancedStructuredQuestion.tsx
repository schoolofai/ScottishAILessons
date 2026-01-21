"use client";

import { Label } from "@/components/ui/label";
import { SimplifiedRichTextEditor } from "@/components/ui/simplified-rich-text-editor";
import type { SimplifiedLevel } from "@/components/ui/simplified-math-shortcuts";

interface EnhancedStructuredQuestionProps {
  /** Final answer content (HTML) */
  value: string;
  /** Working out content (HTML) */
  workingOut?: string;
  /** Callback when answer or working changes - now handles HTML content */
  onChange: (answer: string, workingOut?: string) => void;
  /** SQA level for styling (n3 or n4) */
  level: SimplifiedLevel;
  /** Question stem text for drawing modal context */
  questionStem?: string;
}

/**
 * Level-specific color schemes using design system tokens
 */
const LEVEL_STYLES: Record<SimplifiedLevel, {
  banner: string;
  stepBg: string;
  stepNumber: string;
}> = {
  n3: {
    banner: 'bg-green-50 border-green-200',
    stepBg: 'bg-green-100',
    stepNumber: 'bg-green-600 text-white',
  },
  n4: {
    banner: 'bg-blue-50 border-blue-200',
    stepBg: 'bg-blue-100',
    stepNumber: 'bg-blue-600 text-white',
  },
};

/**
 * EnhancedStructuredQuestion - Rich text structured response for NAT3/NAT4
 *
 * Replaces plain textareas with SimplifiedRichTextEditor, enabling:
 * - Math formula input via MathLive
 * - Diagram drawing via Excalidraw
 * - Level-appropriate color theming
 * - Clear separation of working and final answer
 *
 * Two-zone layout:
 * 1. Working Out: Full math + drawing support for showing calculation steps
 * 2. Final Answer: Math support only (drawings typically not needed)
 *
 * @example
 * ```tsx
 * <EnhancedStructuredQuestion
 *   value={currentResponse.response_text || ''}
 *   workingOut={currentResponse.working_out}
 *   onChange={(text, working) => onAnswerChange({
 *     response_text: text,
 *     working_out: working,
 *   })}
 *   level="n3"
 *   questionStem="Calculate 15% of £240"
 * />
 * ```
 */
export function EnhancedStructuredQuestion({
  value,
  workingOut = '',
  onChange,
  level,
  questionStem,
}: EnhancedStructuredQuestionProps) {
  const styles = LEVEL_STYLES[level];

  return (
    <div className="space-y-6">
      {/* How to Answer Banner */}
      <div className={`rounded-lg border p-4 ${styles.banner}`}>
        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span className="text-lg">📝</span>
          How to Answer
        </h4>
        <div className="space-y-2">
          {/* Step 1 */}
          <div className="flex items-start gap-3">
            <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${styles.stepNumber}`}>
              1
            </span>
            <p className="text-sm text-gray-700">
              <strong>Show Your Working</strong> – Write each step of your calculation.
              You can earn marks for correct method even if your final answer is wrong!
            </p>
          </div>
          {/* Step 2 */}
          <div className="flex items-start gap-3">
            <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${styles.stepNumber}`}>
              2
            </span>
            <p className="text-sm text-gray-700">
              <strong>Final Answer</strong> – Write your answer clearly.
              Include units if the question asks for them.
            </p>
          </div>
        </div>
      </div>

      {/* Zone 1: Working Out Section */}
      <div className="space-y-3">
        <Label htmlFor="working-out" className="text-base font-medium text-gray-700 flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${styles.stepNumber}`}>
            1
          </span>
          Show Your Working
        </Label>
        <p className="text-sm text-gray-500 ml-8">
          Show your calculations step by step. Use the <strong>Math</strong> button for fractions and equations,
          or <strong>Draw</strong> to sketch diagrams.
        </p>
        <SimplifiedRichTextEditor
          value={workingOut}
          onChange={(newWorking) => onChange(value, newWorking)}
          placeholder="Step 1: ...
Step 2: ...
Step 3: ..."
          level={level}
          stem={questionStem}
          allowMath={true}
          allowDrawing={true}
        />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 py-2">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">THEN</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Zone 2: Final Answer Section */}
      <div className="space-y-3">
        <Label htmlFor="final-answer" className="text-base font-medium text-gray-700 flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${styles.stepNumber}`}>
            2
          </span>
          Final Answer
        </Label>
        <p className="text-sm text-gray-500 ml-8">
          Write your final answer here. Remember to include units (e.g., cm, £, kg) if needed.
        </p>
        <SimplifiedRichTextEditor
          value={value}
          onChange={(newValue) => onChange(newValue, workingOut)}
          placeholder="Enter your final answer here..."
          level={level}
          allowMath={true}
          allowDrawing={false}  // Drawing not typically needed for final answer
        />
      </div>
    </div>
  );
}
