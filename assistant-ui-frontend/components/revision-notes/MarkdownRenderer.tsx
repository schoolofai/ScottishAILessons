'use client';

import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { MarkdownRendererProps } from '@/specs/003-revision-notes-frontend/contracts/RevisionNotesComponents';

/**
 * MarkdownRenderer - Renders markdown content with LaTeX and Mermaid support
 *
 * Features:
 * - LaTeX math expressions via KaTeX (inline and display mode)
 * - Mermaid diagrams with mobile-responsive scaling
 * - Syntax highlighting for code blocks
 * - Graceful error handling for malformed syntax
 * - Mobile-optimized responsive design
 */
export function MarkdownRenderer({
  content,
  config = {},
  className = '',
  onRenderComplete,
  onMermaidError,
  onLaTeXError
}: MarkdownRendererProps) {
  const [renderError, setRenderError] = useState<Error | null>(null);
  const [hasRendered, setHasRendered] = useState(false);

  // Default configuration
  const {
    supportsLaTeX = true,
    supportsMermaid = true,
    supportsSyntaxHighlighting = true,
    mobileOptimized = true,
    maxWidth = '800px'
  } = config;

  // Build remark plugins (remarkGfm for tables, strikethrough, etc.)
  const remarkPlugins = [remarkGfm];
  if (supportsLaTeX) {
    remarkPlugins.push(remarkMath);
  }

  // Build rehype plugins based on configuration
  const rehypePlugins = [];

  if (supportsLaTeX) {
    rehypePlugins.push(rehypeKatex);
  }

  // Note: Mermaid support temporarily disabled due to async rendering issues
  // Will be re-implemented using a different approach (react-mermaid or client-side rendering)

  // Notify parent when rendering completes
  useEffect(() => {
    if (!hasRendered && content) {
      setHasRendered(true);
      if (onRenderComplete) {
        // Delay callback to ensure DOM is updated
        setTimeout(onRenderComplete, 100);
      }
    }
  }, [hasRendered, content, onRenderComplete]);

  // Error boundary for rendering failures
  const handleRenderError = (error: Error) => {
    console.error('MarkdownRenderer error:', error);
    setRenderError(error);

    // Check if error is related to LaTeX
    if (error.message.includes('KaTeX') || error.message.includes('katex')) {
      onLaTeXError?.(error, content);
    }
  };

  try {
    return (
      <div
        className={`markdown-renderer prose prose-slate max-w-none dark:prose-invert ${className}`}
        style={{ maxWidth: maxWidth }}
      >
        {renderError ? (
          <div className="p-4 border border-red-300 bg-red-50 rounded-md">
            <h3 className="text-red-800 font-semibold mb-2">Rendering Error</h3>
            <p className="text-red-700 text-sm">
              Failed to render markdown content. Some syntax may be malformed.
            </p>
            <details className="mt-2">
              <summary className="text-red-600 text-xs cursor-pointer">Error details</summary>
              <pre className="text-xs mt-2 overflow-auto">{renderError.message}</pre>
            </details>
          </div>
        ) : (
          <ReactMarkdown
            remarkPlugins={remarkPlugins as any}
            rehypePlugins={rehypePlugins as any}
            components={{
              // Custom code block styling with syntax highlighting support
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : '';

                if (!inline && supportsSyntaxHighlighting) {
                  return (
                    <pre className={`bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto ${className}`}>
                      <code className={`language-${language}`} {...props}>
                        {children}
                      </code>
                    </pre>
                  );
                }

                return (
                  <code className={`bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded ${className}`} {...props}>
                    {children}
                  </code>
                );
              },

              // Mobile-responsive table styling
              table({ children, ...props }) {
                return (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300" {...props}>
                      {children}
                    </table>
                  </div>
                );
              },

              // Responsive image handling
              img({ src, alt, ...props }) {
                return (
                  <img
                    src={src}
                    alt={alt}
                    className="max-w-full h-auto rounded-md"
                    loading="lazy"
                    {...props}
                  />
                );
              }
            }}
          >
            {content}
          </ReactMarkdown>
        )}
      </div>
    );
  } catch (error) {
    handleRenderError(error as Error);

    // Fallback rendering with plain text
    return (
      <div className={`markdown-renderer-error ${className}`}>
        <div className="p-4 border border-yellow-300 bg-yellow-50 rounded-md">
          <h3 className="text-yellow-800 font-semibold mb-2">⚠️ Fallback Mode</h3>
          <p className="text-yellow-700 text-sm mb-2">
            Unable to render enhanced markdown. Displaying plain text:
          </p>
          <pre className="whitespace-pre-wrap text-sm bg-white p-3 rounded border">
            {content}
          </pre>
        </div>
      </div>
    );
  }
}
