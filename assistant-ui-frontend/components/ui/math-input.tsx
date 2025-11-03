"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Button } from './button';
import 'mathlive/static.css';

interface MathInputProps {
  onInsert: (latex: string) => void;
  onCancel: () => void;
  initialValue?: string;
  onMathfieldReady?: (ref: React.RefObject<any>) => void;
}

export function MathInput({ onInsert, onCancel, initialValue = '', onMathfieldReady }: MathInputProps) {
  const mathfieldRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Dynamically import MathLive to avoid SSR issues
    import('mathlive').then((MathLive) => {
      if (mathfieldRef.current) {
        // Initialize the mathfield
        const mf = mathfieldRef.current;

        // Set initial value
        if (initialValue) {
          mf.value = initialValue;
        }

        // Configure virtual keyboard for mobile
        mf.mathVirtualKeyboardPolicy = 'auto';

        // Configure keyboard layouts
        mf.virtualKeyboardMode = 'onfocus';

        setIsReady(true);

        // Notify parent that mathfield is ready
        if (onMathfieldReady) {
          onMathfieldReady(mathfieldRef);
        }
      }
    });
  }, [initialValue, onMathfieldReady]);

  const handleInsert = () => {
    if (mathfieldRef.current) {
      const latex = mathfieldRef.current.value;
      if (latex && latex.trim()) {
        onInsert(latex);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleInsert();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="math-input-container p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-border">
      <div className="space-y-3">
        <div className="text-sm font-medium text-foreground">
          Build your equation using the visual editor:
        </div>

        {/* MathLive editor - larger on mobile for touch */}
        <math-field
          ref={mathfieldRef}
          className="w-full min-h-[100px] md:min-h-[80px] p-4 md:p-3 bg-white dark:bg-background border-2 border-input rounded-lg text-3xl md:text-2xl touch-manipulation"
          onKeyDown={handleKeyDown}
          style={{
            fontSize: 'clamp(20px, 5vw, 28px)',
            padding: 'clamp(12px, 3vw, 16px)',
            borderRadius: '8px',
            minHeight: '100px',
          }}
        >
          {initialValue}
        </math-field>

        {/* Helpful tips */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Tips:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Use the keyboard that appears to insert symbols</li>
            <li>On desktop: Type directly or use keyboard shortcuts</li>
            <li>Fractions: Click the fraction button or type <code>/</code></li>
            <li>Powers: Click x² or type <code>^</code></li>
            <li>Square root: Click √ button</li>
          </ul>
        </div>

        {/* Action buttons - larger on mobile */}
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="md:text-sm text-base md:px-3 px-6 md:py-2 py-3 touch-manipulation"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleInsert}
            className="md:text-sm text-base md:px-3 px-6 md:py-2 py-3 touch-manipulation"
          >
            Insert Equation
          </Button>
        </div>
      </div>
    </div>
  );
}

// TypeScript declaration for custom element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': any;
    }
  }
}
