"use client";

import React, { useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from './button';
import { MathInput } from './math-input';
import { MathShortcuts } from './math-shortcuts';
import { DrawingModal } from './drawing-modal';
import { Math } from '@/lib/tiptap-math-extension';
import { Image } from '@/lib/tiptap-image-extension';
import katex from 'katex';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  stem?: string; // Optional lesson question/stem to show in drawing modal
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter your answer...",
  className = "",
  stem
}: RichTextEditorProps) {
  const [showMathInput, setShowMathInput] = useState(false);
  const [isMathfieldReady, setIsMathfieldReady] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [editingSceneData, setEditingSceneData] = useState<any>(null);
  const mathfieldRef = useRef<any>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
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

  const handleDrawingInsert = (base64Image: string, sceneData?: any) => {
    if (!editor || !base64Image) return;

    try {
      // If editing, delete the old image first
      if (editingSceneData) {
        editor.chain().focus().deleteSelection().run();
      }

      // Insert image with base64 data URI and scene data for editing
      const dataUri = `data:image/png;base64,${base64Image}`;

      const sceneDataString = sceneData ? JSON.stringify(sceneData) : undefined;

      console.log('🎨 SCENE DATA DEBUG - handleDrawingInsert:', {
        hasSceneData: !!sceneData,
        elements: sceneData?.elements?.length || 0,
        sceneDataStringLength: sceneDataString?.length || 0,
        firstChars: sceneDataString?.substring(0, 100),
        isEdit: !!editingSceneData
      });

      editor.chain()
        .focus()
        .setImage({
          src: dataUri,
          dataScene: sceneDataString  // Store scene for editing
        })
        .insertContent('<p></p>') // Add paragraph after image for continued typing
        .run();

      console.log('✅ Drawing inserted into rich text editor');

      // Verify the image was inserted with scene data
      setTimeout(() => {
        const images = editor.view.dom.querySelectorAll('img');
        const lastImage = images[images.length - 1];
        if (lastImage) {
          const storedSceneData = lastImage.getAttribute('data-scene');
          console.log('🔍 VERIFICATION - Image inserted with data-scene:', {
            hasDataScene: !!storedSceneData,
            length: storedSceneData?.length || 0,
            firstChars: storedSceneData?.substring(0, 100)
          });
        }
      }, 100);

      // Clear editing state
      setEditingSceneData(null);
    } catch (error) {
      console.error('❌ Failed to insert drawing into editor:', error);
      alert('Failed to insert drawing. Please try again.');
    }
  };

  const handleImageClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    console.log('🖱️ ═══════════════════════════════════════════════════');
    console.log('🖱️ IMAGE CLICKED IN EDITOR');
    console.log('🖱️ ═══════════════════════════════════════════════════');
    console.log('🖱️ Click event details:', {
      tagName: target.tagName,
      isImg: target.tagName === 'IMG',
      clientX: event.clientX,
      clientY: event.clientY,
      timestamp: new Date().toISOString()
    });

    // Check if clicked element is an image with scene data
    if (target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      const sceneDataAttr = img.getAttribute('data-scene');

      console.log('🎨 Image attributes:', {
        src: img.src?.substring(0, 50) + '...',
        width: img.width,
        height: img.height,
        hasDataScene: !!sceneDataAttr,
        dataSceneLength: sceneDataAttr?.length || 0
      });

      if (sceneDataAttr) {
        try {
          const sceneData = JSON.parse(sceneDataAttr);
          console.log('✅ SCENE DATA PARSED SUCCESSFULLY:', {
            elements: sceneData.elements?.length || 0,
            hasAppState: !!sceneData.appState,
            hasFiles: !!sceneData.files,
            fileCount: sceneData.files ? Object.keys(sceneData.files).length : 0
          });

          // Log element positions from stored scene data
          if (sceneData.elements && sceneData.elements.length > 0) {
            console.log('🎯 STORED SCENE DATA - Element positions (first 3):');
            sceneData.elements.slice(0, 3).forEach((el: any, idx: number) => {
              console.log(`  Element ${idx}: type=${el.type}, x=${el.x}, y=${el.y}, width=${el.width}, height=${el.height}`);
            });
          }

          // Log appState if present
          if (sceneData.appState) {
            console.log('📊 STORED SCENE DATA - AppState:', {
              zoom: sceneData.appState.zoom,
              scrollX: sceneData.appState.scrollX,
              scrollY: sceneData.appState.scrollY,
              viewBackgroundColor: sceneData.appState.viewBackgroundColor
            });
          } else {
            console.log('⚠️ STORED SCENE DATA - No appState found');
          }

          // Select the image node in editor
          const pos = editor?.view.posAtDOM(img, 0);
          if (pos !== undefined && editor) {
            editor.commands.setNodeSelection(pos);
            console.log('✅ Image selected in editor at position:', pos);
          }

          // Open modal with scene data for editing
          console.log('🚀 Setting editing scene data and opening modal...');
          setEditingSceneData(sceneData);
          setShowDrawModal(true);
          console.log('🚀 DrawingModal state updated (should open now)');
          console.log('🖱️ ═══════════════════════════════════════════════════');
        } catch (error) {
          console.error('❌ Failed to parse scene data:', error);
          console.error('❌ Raw scene data:', sceneDataAttr?.substring(0, 200));
          console.log('🖱️ ═══════════════════════════════════════════════════');
        }
      } else {
        console.log('⚠️ No data-scene attribute found on image');
        console.log('⚠️ Available attributes:', Array.from(img.attributes).map(attr => attr.name));
        console.log('🖱️ ═══════════════════════════════════════════════════');
      }
    }
  };

  // Attach click handler to editor for image editing
  React.useEffect(() => {
    if (!editor) return;

    const editorElement = editor.view.dom;
    editorElement.addEventListener('click', handleImageClick);

    return () => {
      editorElement.removeEventListener('click', handleImageClick);
    };
  }, [editor]);

  if (!editor) {
    return <div className="h-[150px] border rounded-lg bg-gray-50 animate-pulse" />;
  }

  return (
    <>
      {/* CSS for selected image styling and edit affordance */}
      <style dangerouslySetInnerHTML={{__html: `
        .rich-text-editor .ProseMirror img.ProseMirror-selectednode {
          outline: 3px solid #3b82f6;
          outline-offset: 2px;
          border-radius: 4px;
          cursor: pointer;
        }

        .rich-text-editor .ProseMirror img {
          max-width: 100%;
          height: auto;
          transition: all 0.2s ease;
        }

        /* Editable diagrams (with data-scene) get special hover effect */
        .rich-text-editor .ProseMirror img[data-scene] {
          cursor: pointer;
          position: relative;
        }

        .rich-text-editor .ProseMirror img[data-scene]:hover {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
          border-radius: 4px;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
          transform: scale(1.02);
        }

        /* Non-editable images have default cursor */
        .rich-text-editor .ProseMirror img:not([data-scene]) {
          cursor: default;
        }

        .rich-text-editor .ProseMirror img:not([data-scene]):hover {
          outline: 1px solid #e5e7eb;
          outline-offset: 2px;
          border-radius: 4px;
        }
      `}} />

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
          onClick={() => setShowDrawModal(true)}
          className="md:text-sm text-base md:min-w-0 min-w-[100px] md:px-3 px-4 md:py-2 py-3"
        >
          <span className="text-lg md:text-base">✏️</span>
          <span className="ml-1">Draw</span>
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().clearContent().run()}
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

      {/* Drawing Modal */}
      <DrawingModal
        open={showDrawModal}
        onClose={() => {
          setShowDrawModal(false);
          setEditingSceneData(null);  // Clear editing state on close
        }}
        onInsert={handleDrawingInsert}
        stem={stem}
        initialSceneData={editingSceneData}
      />
      </div>
    </>
  );
}
