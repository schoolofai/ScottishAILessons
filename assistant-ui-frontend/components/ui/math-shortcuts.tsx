"use client";

import React from 'react';
import { Button } from './button';

interface MathShortcut {
  label: string;
  latex: string;
  tooltip: string;
  moveCursor?: boolean;
}

const shortcuts: MathShortcut[] = [
  { label: 'x²', latex: '^2', tooltip: 'Square' },
  { label: 'x³', latex: '^3', tooltip: 'Cube' },
  { label: 'xⁿ', latex: '^{}', tooltip: 'Power', moveCursor: true },
  { label: '√', latex: '\\sqrt{}', tooltip: 'Square root', moveCursor: true },
  { label: '∛', latex: '\\sqrt[3]{}', tooltip: 'Cube root', moveCursor: true },
  { label: '½', latex: '\\frac{}{}', tooltip: 'Fraction', moveCursor: true },
  { label: 'x₁', latex: '_{}', tooltip: 'Subscript', moveCursor: true },
  { label: '±', latex: '\\pm', tooltip: 'Plus/minus' },
  { label: '=', latex: '=', tooltip: 'Equals' },
  { label: '≠', latex: '\\neq', tooltip: 'Not equals' },
  { label: '≤', latex: '\\leq', tooltip: 'Less or equal' },
  { label: '≥', latex: '\\geq', tooltip: 'Greater or equal' },
  { label: 'π', latex: '\\pi', tooltip: 'Pi' },
  { label: '°', latex: '^\\circ', tooltip: 'Degrees' },
  { label: '∞', latex: '\\infty', tooltip: 'Infinity' },
];

interface MathShortcutsProps {
  mathfieldRef: React.RefObject<any>;
  disabled?: boolean;
}

export function MathShortcuts({ mathfieldRef, disabled = false }: MathShortcutsProps) {
  const insertLatex = (shortcut: MathShortcut) => {
    if (!mathfieldRef.current || disabled) return;

    const mf = mathfieldRef.current;

    // Insert the LaTeX command
    mf.executeCommand(['insert', shortcut.latex]);

    // Move cursor inside placeholder if needed
    if (shortcut.moveCursor) {
      mf.executeCommand('moveToPreviousChar');
    }

    // Focus the mathfield
    mf.focus();
  };

  return (
    <>
      {/* Desktop: All buttons in one row */}
      <div className="hidden md:flex flex-wrap gap-1">
        {shortcuts.map((shortcut, index) => (
          <Button
            key={index}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertLatex(shortcut)}
            disabled={disabled}
            title={shortcut.tooltip}
            className="min-w-[32px] px-2 hover:bg-accent"
          >
            {shortcut.label}
          </Button>
        ))}
      </div>

      {/* Mobile: Dropdown menu */}
      <div className="md:hidden">
        <select
          onChange={(e) => {
            const index = parseInt(e.target.value);
            if (!isNaN(index)) {
              insertLatex(shortcuts[index]);
              e.target.value = ''; // Reset selection
            }
          }}
          disabled={disabled}
          className="px-3 py-1.5 text-sm border border-input rounded-md bg-background hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Symbols ▼</option>
          {shortcuts.map((shortcut, index) => (
            <option key={index} value={index}>
              {shortcut.label} - {shortcut.tooltip}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
