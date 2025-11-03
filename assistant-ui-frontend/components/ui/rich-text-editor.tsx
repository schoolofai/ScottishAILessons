"use client";

import React, { useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from './button';
import { MathInput } from './math-input';
import { MathShortcuts } from './math-shortcuts';
import { Math } from '@/lib/tiptap-math-extension';
import katex from 'katex';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter your answer...",
  className = ""
}: RichTextEditorProps) {
  const [showMathInput, setShowMathInput] = useState(false);
  const [isMathfieldReady, setIsMathfieldReady] = useState(false);
  const mathfieldRef = useRef<any>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
      Math,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[150px] p-4',
      },
    },
  });

  const handleMathfieldReady = (ref: React.RefObject<any>) => {
    mathfieldRef.current = ref.current;
    setIsMathfieldReady(true);
  };

  const handleMathInsert = (latex: string) => {
    if (!latex.trim() || !editor) return;

    try {
      // Render LaTeX using KaTeX
      const html = katex.renderToString(latex, {
        displayMode: false,
        throwOnError: false,
      });

      // Use the custom insertMath command
      editor.chain().focus().insertMath(latex, html).insertContent(' ').run();

      setShowMathInput(false);
      setIsMathfieldReady(false);
    } catch (error) {
      // Only alert if KaTeX rendering fails, not editor operations
      if (error instanceof Error && error.message.includes('KaTeX')) {
        console.error('KaTeX render error:', error);
        alert('Invalid LaTeX formula. Please check your syntax.');
      } else {
        // Log other errors but don't alert (they might be internal editor state transitions)
        console.error('Math insert error:', error);
      }
    }
  };

  const handleMathCancel = () => {
    setShowMathInput(false);
    setIsMathfieldReady(false);
  };

  if (!editor) {
    return <div className="h-[150px] border rounded-lg bg-gray-50 animate-pulse" />;
  }

  return (
    <div className={`rich-text-editor border border-input rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-muted/30">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-primary/10 text-primary' : ''}
        >
          <strong>B</strong>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-primary/10 text-primary' : ''}
        >
          <em>I</em>
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'bg-primary/10 text-primary' : ''}
        >
          • List
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'bg-primary/10 text-primary' : ''}
        >
          1. List
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowMathInput(!showMathInput)}
          className={`${showMathInput ? 'bg-primary/10 text-primary' : ''} md:text-sm text-base md:min-w-0 min-w-[100px] md:px-3 px-4 md:py-2 py-3`}
        >
          <span className="text-lg md:text-base">Σ</span>
          <span className="ml-1">Formula</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        >
          Clear
        </Button>
      </div>

      {/* Math Input Visual Editor */}
      {showMathInput && (
        <>
          {/* Math Shortcuts */}
          <div className="px-2 py-2 border-b border-border bg-muted/20">
            <MathShortcuts
              mathfieldRef={mathfieldRef}
              disabled={!isMathfieldReady}
            />
          </div>

          <MathInput
            onInsert={handleMathInsert}
            onCancel={handleMathCancel}
            onMathfieldReady={handleMathfieldReady}
          />
        </>
      )}

      {/* Editor Content */}
      <EditorContent editor={editor} className="bg-white dark:bg-background" />
    </div>
  );
}
