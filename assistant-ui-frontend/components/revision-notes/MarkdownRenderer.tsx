'use client';

import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
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
  const [mermaidInitialized, setMermaidInitialized] = useState(false);
  const mermaidContainerRef = useRef<HTMLDivElement>(null);

  // Preprocess markdown content to fix common formatting issues
  const processedContent = React.useMemo(() => {
    let processed = content;

    // Ensure headings have proper spacing: "# Heading" not "#Heading"
    processed = processed.replace(/^(#{1,6})([^\s#])/gm, '$1 $2');

    // Ensure blank line after headings for better parsing
    processed = processed.replace(/^(#{1,6}\s+.+)$/gm, '$1\n');

    // Remove any leading/trailing whitespace
    processed = processed.trim();

    return processed;
  }, [content]);

  // Default configuration
  const {
    supportsLaTeX = true,
    supportsMermaid = true,
    supportsSyntaxHighlighting = true,
    mobileOptimized = true,
    maxWidth = '800px'
  } = config;

  // Initialize Mermaid with responsive configuration and error handling
  useEffect(() => {
    if (supportsMermaid && !mermaidInitialized) {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          themeVariables: {
            fontSize: '16px',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif'
          },
          // Responsive diagram scaling
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis'
          },
          sequence: {
            useMaxWidth: true,
            wrap: true,
            width: 150
          },
          gantt: {
            useMaxWidth: true
          },
          // Error handling callback
          errorRenderer: (id: string, message: string, type: string) => {
            console.error(`Mermaid error in diagram ${id}:`, message, type);
            if (onMermaidError) {
              onMermaidError(new Error(message), '');
            }
            // Return error visualization
            return `<div class="mermaid-error p-4 border border-red-300 bg-red-50 rounded-md">
              <h4 class="text-red-800 font-semibold text-sm mb-1">Mermaid Diagram Error</h4>
              <p class="text-red-700 text-xs">${message}</p>
            </div>`;
          }
        });
        setMermaidInitialized(true);
      } catch (error) {
        console.error('Failed to initialize Mermaid:', error);
        if (onMermaidError) {
          onMermaidError(error as Error, '');
        }
      }
    }
  }, [supportsMermaid, mermaidInitialized, onMermaidError]);

  // Build remark plugins (remarkGfm for tables, strikethrough, etc.)
  const remarkPlugins = [remarkGfm];
  if (supportsLaTeX) {
    remarkPlugins.push(remarkMath);
  }

  // Build rehype plugins with error handling
  const rehypePlugins: any[] = [];

  // Add rehypeRaw first to parse HTML elements like <details>, <summary>
  // This allows interactive collapsible sections in revision notes
  rehypePlugins.push(rehypeRaw);

  if (supportsLaTeX) {
    // Add KaTeX with error handling configuration
    rehypePlugins.push([rehypeKatex, {
      throwOnError: false,  // Don't throw errors, display error indicators instead
      errorColor: '#cc0000',
      strict: false,
      output: 'htmlAndMathml',
      trust: false,
      // Custom error handler
      onError: (error: any) => {
        console.warn('KaTeX rendering error:', error.message);
        if (onLaTeXError) {
          onLaTeXError(error, content);
        }
      }
    }]);
  }

  // Render Mermaid diagrams after component mounts
  useEffect(() => {
    if (supportsMermaid && mermaidInitialized && mermaidContainerRef.current) {
      const renderMermaidDiagrams = async () => {
        try {
          // Find all mermaid code blocks
          const mermaidBlocks = mermaidContainerRef.current?.querySelectorAll('.language-mermaid');

          if (mermaidBlocks && mermaidBlocks.length > 0) {
            for (let i = 0; i < mermaidBlocks.length; i++) {
              const block = mermaidBlocks[i];
              const code = block.textContent || '';
              const id = `mermaid-diagram-${i}-${Date.now()}`;

              try {
                // Render mermaid diagram
                const { svg } = await mermaid.render(id, code);

                // Replace code block with rendered SVG
                const wrapper = document.createElement('div');
                wrapper.className = 'mermaid-diagram my-6 flex justify-center';
                wrapper.innerHTML = svg;

                block.parentElement?.replaceWith(wrapper);
              } catch (error: any) {
                console.error(`Failed to render Mermaid diagram ${id}:`, error);

                // Display error indicator
                const errorDiv = document.createElement('div');
                errorDiv.className = 'p-4 border border-red-300 bg-red-50 rounded-md my-6';
                errorDiv.innerHTML = `
                  <h4 class="text-red-800 font-semibold text-sm mb-1">⚠️ Mermaid Diagram Error</h4>
                  <p class="text-red-700 text-xs mb-2">${error.message || 'Failed to render diagram'}</p>
                  <details class="text-xs">
                    <summary class="cursor-pointer text-red-600">Show diagram code</summary>
                    <pre class="mt-2 p-2 bg-white rounded border overflow-auto">${code}</pre>
                  </details>
                `;

                block.parentElement?.replaceWith(errorDiv);

                if (onMermaidError) {
                  onMermaidError(error, code);
                }
              }
            }
          }
        } catch (error) {
          console.error('Mermaid rendering error:', error);
        }
      };

      // Delay to ensure DOM is ready
      setTimeout(renderMermaidDiagrams, 50);
    }
  }, [content, supportsMermaid, mermaidInitialized, onMermaidError]);

  // Notify parent when rendering completes
  useEffect(() => {
    if (!hasRendered && content) {
      setHasRendered(true);
      if (onRenderComplete) {
        // Delay callback to ensure DOM is updated
        setTimeout(onRenderComplete, 150);
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
        ref={mermaidContainerRef}
        className={`markdown-renderer
          prose prose-sm sm:prose-base md:prose-lg
          prose-slate max-w-none dark:prose-invert
          prose-headings:mb-4 prose-headings:mt-8 prose-headings:font-semibold
          prose-p:my-4 prose-p:leading-relaxed prose-p:text-base
          prose-li:my-2 prose-li:leading-relaxed
          prose-table:my-6 prose-table:w-full
          prose-hr:my-8 prose-hr:border-gray-300
          prose-code:text-sm prose-code:px-1.5 prose-code:py-0.5
          prose-pre:my-6 prose-pre:overflow-x-auto prose-pre:rounded-lg
          prose-img:rounded-lg prose-img:shadow-md
          prose-blockquote:border-l-4 prose-blockquote:pl-4 prose-blockquote:italic
          ${mobileOptimized ? 'text-base sm:text-lg overflow-x-hidden' : ''}
          ${className}
        `}
        style={{ maxWidth: mobileOptimized ? '100%' : maxWidth }}
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
              // Custom heading styling (Tailwind Typography plugin not compatible with Tailwind v4)
              h1({ children, ...props }) {
                return (
                  <h1 className="text-4xl font-bold mt-8 mb-4 text-gray-900 dark:text-gray-100" {...props}>
                    {children}
                  </h1>
                );
              },
              h2({ children, ...props }) {
                return (
                  <h2 className="text-3xl font-semibold mt-6 mb-3 text-gray-900 dark:text-gray-100" {...props}>
                    {children}
                  </h2>
                );
              },
              h3({ children, ...props }) {
                return (
                  <h3 className="text-2xl font-semibold mt-5 mb-2 text-gray-800 dark:text-gray-200" {...props}>
                    {children}
                  </h3>
                );
              },
              h4({ children, ...props }) {
                return (
                  <h4 className="text-xl font-semibold mt-4 mb-2 text-gray-800 dark:text-gray-200" {...props}>
                    {children}
                  </h4>
                );
              },
              h5({ children, ...props }) {
                return (
                  <h5 className="text-lg font-semibold mt-3 mb-1 text-gray-800 dark:text-gray-200" {...props}>
                    {children}
                  </h5>
                );
              },
              h6({ children, ...props }) {
                return (
                  <h6 className="text-base font-semibold mt-2 mb-1 text-gray-800 dark:text-gray-200" {...props}>
                    {children}
                  </h6>
                );
              },

              // Custom code block styling with syntax highlighting and Mermaid support
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : '';

                // Block-level code (not inline)
                if (!inline) {
                  // Mermaid diagrams - preserve class for post-processing
                  if (language === 'mermaid' && supportsMermaid) {
                    return (
                      <pre className="mermaid-placeholder bg-gray-50 border border-gray-200 p-6 rounded-md my-6">
                        <code className={`language-mermaid hidden`} {...props}>
                          {children}
                        </code>
                        <div className="text-gray-500 text-sm animate-pulse">
                          Loading diagram...
                        </div>
                      </pre>
                    );
                  }

                  // Regular code blocks with syntax highlighting
                  if (supportsSyntaxHighlighting) {
                    return (
                      <pre className={`bg-gray-100 dark:bg-gray-800 p-4 sm:p-6 rounded-lg overflow-x-auto my-6 text-sm sm:text-base ${className}`}>
                        <code className={`language-${language} leading-relaxed block`} {...props}>
                          {children}
                        </code>
                      </pre>
                    );
                  }
                }

                // Inline code
                return (
                  <code className={`bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm ${className}`} {...props}>
                    {children}
                  </code>
                );
              },

              // List styling with better spacing
              ul({ children, ...props }) {
                return (
                  <ul className="space-y-2 my-4" {...props}>
                    {children}
                  </ul>
                );
              },

              ol({ children, ...props }) {
                return (
                  <ol className="space-y-2 my-4" {...props}>
                    {children}
                  </ol>
                );
              },

              // Blockquote styling with better spacing
              blockquote({ children, ...props }) {
                return (
                  <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-6 py-2 my-6 italic text-gray-700 dark:text-gray-300" {...props}>
                    {children}
                  </blockquote>
                );
              },

              // Mobile-responsive table styling with better spacing
              table({ children, ...props }) {
                return (
                  <div className="overflow-x-auto my-6">
                    <table className="min-w-full divide-y divide-gray-300 border-collapse" {...props}>
                      {children}
                    </table>
                  </div>
                );
              },

              // Table header styling
              thead({ children, ...props }) {
                return (
                  <thead className="bg-gray-100 dark:bg-gray-800" {...props}>
                    {children}
                  </thead>
                );
              },

              // Table header cell styling
              th({ children, ...props }) {
                return (
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100" {...props}>
                    {children}
                  </th>
                );
              },

              // Table body cell styling
              td({ children, ...props }) {
                return (
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700" {...props}>
                    {children}
                  </td>
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
            {processedContent}
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
            {processedContent}
          </pre>
        </div>
      </div>
    );
  }
}
