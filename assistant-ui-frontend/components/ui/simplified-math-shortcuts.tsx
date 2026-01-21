"use client";

import React from 'react';
import { Button } from './button';

/**
 * Math shortcut definition with display label, LaTeX code, and tooltip
 */
interface MathShortcut {
  label: string;
  latex: string;
  tooltip: string;
  moveCursor?: boolean;
}

/**
 * Level configuration for math shortcuts
 * NAT3 students get basic arithmetic (8 symbols)
 * NAT4 students get intermediate math (12 symbols)
 */
export type SimplifiedLevel = 'n3' | 'n4';

/**
 * Basic math shortcuts for NAT3 (8 symbols)
 * Focus: Arithmetic operations and simple comparisons
 */
const BASIC_SHORTCUTS: MathShortcut[] = [
  { label: '+', latex: '+', tooltip: 'Plus' },
  { label: '−', latex: '-', tooltip: 'Minus' },
  { label: '×', latex: '\\times', tooltip: 'Multiply' },
  { label: '÷', latex: '\\div', tooltip: 'Divide' },
  { label: '=', latex: '=', tooltip: 'Equals' },
  { label: '<', latex: '<', tooltip: 'Less than' },
  { label: '>', latex: '>', tooltip: 'Greater than' },
  { label: '½', latex: '\\frac{}{}', tooltip: 'Fraction', moveCursor: true },
];

/**
 * Intermediate shortcuts for NAT4 (12 symbols)
 * Adds: powers, roots, and inequalities
 */
const INTERMEDIATE_SHORTCUTS: MathShortcut[] = [
  ...BASIC_SHORTCUTS,
  { label: 'x²', latex: '^2', tooltip: 'Square' },
  { label: '√', latex: '\\sqrt{}', tooltip: 'Square root', moveCursor: true },
  { label: '≤', latex: '\\leq', tooltip: 'Less or equal' },
  { label: '≥', latex: '\\geq', tooltip: 'Greater or equal' },
];

interface SimplifiedMathShortcutsProps {
  /** Reference to the MathLive mathfield element */
  mathfieldRef: React.RefObject<any>;
  /** Disable shortcuts when mathfield isn't ready */
  disabled?: boolean;
  /** SQA level determines which shortcuts to show */
  level: SimplifiedLevel;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * SimplifiedMathShortcuts - Level-appropriate math symbol palette
 *
 * Designed for NAT3/NAT4 students with:
 * - Larger touch targets (48px) for accessibility
 * - Level-appropriate color theming
 * - Reduced cognitive load compared to full MathShortcuts
 *
 * @example
 * ```tsx
 * <SimplifiedMathShortcuts
 *   mathfieldRef={mathfieldRef}
 *   level="n3"
 *   disabled={!isMathfieldReady}
 * />
 * ```
 */
export function SimplifiedMathShortcuts({
  mathfieldRef,
  disabled = false,
  level,
  className = "",
}: SimplifiedMathShortcutsProps) {
  const shortcuts = level === 'n3' ? BASIC_SHORTCUTS : INTERMEDIATE_SHORTCUTS;

  /**
   * Insert LaTeX command into MathLive mathfield
   * Handles cursor positioning for commands with placeholders
   */
  const insertLatex = (shortcut: MathShortcut) => {
    if (!mathfieldRef.current || disabled) return;

    const mf = mathfieldRef.current;

    // Insert the LaTeX command
    mf.executeCommand(['insert', shortcut.latex]);

    // Move cursor inside placeholder if needed (e.g., for fractions)
    if (shortcut.moveCursor) {
      mf.executeCommand('moveToPreviousChar');
    }

    // Focus the mathfield
    mf.focus();
  };

  // Level-specific styling using design system tokens
  const levelStyles = {
    n3: {
      buttonBg: 'hover:bg-green-50',
      buttonBorder: 'border-green-200',
      buttonHoverBorder: 'hover:border-green-400',
      activeRing: 'focus:ring-green-500',
    },
    n4: {
      buttonBg: 'hover:bg-blue-50',
      buttonBorder: 'border-blue-200',
      buttonHoverBorder: 'hover:border-blue-400',
      activeRing: 'focus:ring-blue-500',
    },
  };

  const styles = levelStyles[level];

  return (
    <div
      className={`simplified-math-shortcuts ${className}`}
      data-level={level}
    >
      {/* Desktop view: grid layout */}
      <div className="hidden md:flex flex-wrap gap-2">
        {shortcuts.map((shortcut, index) => (
          <Button
            key={index}
            type="button"
            variant="outline"
            onClick={() => insertLatex(shortcut)}
            disabled={disabled}
            title={shortcut.tooltip}
            className={`
              shortcut-btn
              min-h-[44px] min-w-[44px]
              text-lg font-medium
              ${styles.buttonBg}
              ${styles.buttonBorder}
              ${styles.buttonHoverBorder}
              ${styles.activeRing}
              transition-colors duration-150
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {shortcut.label}
          </Button>
        ))}
      </div>

      {/* Mobile view: larger buttons in responsive grid */}
      <div className="md:hidden grid grid-cols-4 gap-2">
        {shortcuts.map((shortcut, index) => (
          <Button
            key={index}
            type="button"
            variant="outline"
            onClick={() => insertLatex(shortcut)}
            disabled={disabled}
            title={shortcut.tooltip}
            className={`
              shortcut-btn
              min-h-[48px]
              text-xl font-medium
              ${styles.buttonBg}
              ${styles.buttonBorder}
              ${styles.buttonHoverBorder}
              ${styles.activeRing}
              transition-colors duration-150
              touch-manipulation
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {shortcut.label}
          </Button>
        ))}
      </div>

      {/* Symbol count indicator for younger students */}
      <p className="text-xs text-muted-foreground mt-2 text-center md:text-left">
        {shortcuts.length} symbols available • Tap to insert
      </p>
    </div>
  );
}
