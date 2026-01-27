"use client";

import React, { FC, memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Normalize LaTeX delimiters for remark-math compatibility.
 *
 * Converts:
 * - \( ... \) → $...$  (inline math)
 * - \[ ... \] → $$...$$ (display math)
 * - Literal \n strings → actual newlines
 *
 * remark-math only supports $...$ and $$...$$ by default.
 */
function normalizeLatexDelimiters(text: string): string {
  if (!text) return text;

  return text
    // Convert literal \n to actual newlines (common in database storage)
    .replace(/\\n/g, '\n')
    // Convert \( ... \) to $...$
    .replace(/\\\(\s*/g, '$')
    .replace(/\s*\\\)/g, '$')
    // Convert \[ ... \] to $$...$$
    .replace(/\\\[\s*/g, '$$')
    .replace(/\s*\\\]/g, '$$');
}

/**
 * Wrap standalone LaTeX math commands in $ delimiters.
 *
 * Handles math-mode commands that appear outside of $ delimiters:
 * - \text{...} with numbers (e.g., \text{£}24{,}960)
 * - \frac{...}{...}
 * - Numbers with LaTeX formatting like {,} for thousands separator
 *
 * This fixes content where LaTeX was stored without proper delimiters.
 */
function wrapStandaloneLatexMath(text: string): string {
  if (!text) return text;

  let result = text;

  // Pattern to match \text{...} followed by numbers/math
  // e.g., \text{£}24{,}960 or \text{£}82.56
  // Captures the full math expression including trailing numbers
  result = result.replace(
    /\\text\{([^}]*)\}([\d{},.\s]+)/g,
    (match) => `$${match}$`
  );

  // Pattern to match standalone \frac{...}{...} not already in $ delimiters
  // Only wrap if not already inside $ delimiters
  result = result.replace(
    /(?<!\$)\\frac\{([^}]*)\}\{([^}]*)\}(?!\$)/g,
    (match) => `$${match}$`
  );

  // Pattern to match percentages with LaTeX formatting
  // e.g., 8.2\% becomes $8.2\%$
  result = result.replace(
    /(\d+(?:\.\d+)?)\s*\\%/g,
    (match) => `$${match}$`
  );

  return result;
}

/**
 * Preprocess LaTeX document structures that KaTeX doesn't support.
 * Converts LaTeX document commands to Markdown equivalents.
 *
 * Handles:
 * - \begin{itemize}...\end{itemize} → Markdown bullet list
 * - \begin{enumerate}...\end{enumerate} → Markdown numbered list
 * - \item → List item (- or number based on context)
 * - \textbf{...} → **bold**
 * - \textit{...} → *italic*
 * - \\ or \newline → Line break
 */
function preprocessLatexDocument(text: string): string {
  if (!text) return text;

  // First normalize delimiters and wrap standalone math
  let result = normalizeLatexDelimiters(text);
  result = wrapStandaloneLatexMath(result);

  // Process enumerate environments (numbered lists)
  result = result.replace(
    /\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g,
    (_match, content) => {
      let counter = 0;
      const processed = content
        .replace(/\\item\s*/g, () => {
          counter++;
          return `\n${counter}. `;
        })
        .trim();
      return `\n${processed}\n`;
    }
  );

  // Process itemize environments (bullet lists)
  result = result.replace(
    /\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g,
    (_match, content) => {
      const processed = content
        .replace(/\\item\s*/g, '\n- ')
        .trim();
      return `\n${processed}\n`;
    }
  );

  // Handle any remaining standalone \item (outside of environments)
  result = result.replace(/\\item\s*/g, '\n- ');

  // Convert \textbf{...} to **bold**
  result = result.replace(/\\textbf\{([^}]*)\}/g, '**$1**');

  // Convert \textit{...} to *italic*
  result = result.replace(/\\textit\{([^}]*)\}/g, '*$1*');

  // Convert \underline{...} to <u>underline</u> (HTML since MD doesn't support)
  result = result.replace(/\\underline\{([^}]*)\}/g, '<u>$1</u>');

  // Convert \\ or \newline to line breaks (but not inside math mode)
  // Only convert standalone \\ that's not part of math
  result = result.replace(/(?<!\$)\\\\(?!\$)/g, '  \n');
  result = result.replace(/\\newline/g, '  \n');

  // Clean up multiple consecutive newlines
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

/**
 * MarkdownRenderer - Standalone markdown renderer for exam content
 *
 * Features:
 * - GitHub Flavored Markdown (tables, strikethrough, etc.)
 * - LaTeX math rendering via KaTeX
 * - LaTeX document structure preprocessing (itemize, enumerate, etc.)
 * - Consistent styling with the application theme
 */
export const MarkdownRenderer: FC<MarkdownRendererProps> = memo(({ content, className }) => {
  // Preprocess LaTeX document structures before rendering
  const processedContent = useMemo(() => preprocessLatexDocument(content), [content]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      className={cn("prose prose-sm max-w-none dark:prose-invert", className)}
      components={{
        h1: ({ className: cls, ...props }) => (
          <h1
            className={cn(
              "mb-4 scroll-m-20 text-2xl font-bold tracking-tight",
              cls
            )}
            {...props}
          />
        ),
        h2: ({ className: cls, ...props }) => (
          <h2
            className={cn(
              "mb-3 mt-6 scroll-m-20 text-xl font-semibold tracking-tight first:mt-0",
              cls
            )}
            {...props}
          />
        ),
        h3: ({ className: cls, ...props }) => (
          <h3
            className={cn(
              "mb-2 mt-4 scroll-m-20 text-lg font-semibold tracking-tight first:mt-0",
              cls
            )}
            {...props}
          />
        ),
        p: ({ className: cls, ...props }) => (
          <p
            className={cn("mb-3 leading-7 last:mb-0", cls)}
            {...props}
          />
        ),
        ul: ({ className: cls, ...props }) => (
          <ul
            className={cn("my-3 ml-6 list-disc [&>li]:mt-1", cls)}
            {...props}
          />
        ),
        ol: ({ className: cls, ...props }) => (
          <ol
            className={cn("my-3 ml-6 list-decimal [&>li]:mt-1", cls)}
            {...props}
          />
        ),
        li: ({ className: cls, ...props }) => (
          <li className={cn("leading-6", cls)} {...props} />
        ),
        blockquote: ({ className: cls, ...props }) => (
          <blockquote
            className={cn("border-l-4 border-gray-300 pl-4 italic text-gray-600", cls)}
            {...props}
          />
        ),
        code: ({ className: cls, ...props }) => {
          const isInline = !cls?.includes("language-");
          return isInline ? (
            <code
              className={cn(
                "rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm dark:bg-gray-800",
                cls
              )}
              {...props}
            />
          ) : (
            <code className={cn("font-mono text-sm", cls)} {...props} />
          );
        },
        pre: ({ className: cls, ...props }) => (
          <pre
            className={cn(
              "my-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-white",
              cls
            )}
            {...props}
          />
        ),
        table: ({ className: cls, ...props }) => (
          <div className="my-3 overflow-x-auto">
            <table
              className={cn("w-full border-collapse border border-gray-200", cls)}
              {...props}
            />
          </div>
        ),
        th: ({ className: cls, ...props }) => (
          <th
            className={cn(
              "border border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold",
              cls
            )}
            {...props}
          />
        ),
        td: ({ className: cls, ...props }) => (
          <td
            className={cn("border border-gray-200 px-3 py-2", cls)}
            {...props}
          />
        ),
        a: ({ className: cls, ...props }) => (
          <a
            className={cn(
              "text-blue-600 underline underline-offset-2 hover:text-blue-800",
              cls
            )}
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          />
        ),
        strong: ({ className: cls, ...props }) => (
          <strong className={cn("font-semibold", cls)} {...props} />
        ),
        em: ({ className: cls, ...props }) => (
          <em className={cn("italic", cls)} {...props} />
        ),
      }}
    >
      {processedContent}
    </ReactMarkdown>
  );
});

MarkdownRenderer.displayName = "MarkdownRenderer";
