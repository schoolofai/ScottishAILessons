"use client";

import React, { FC, memo } from "react";
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
 * MarkdownRenderer - Standalone markdown renderer for exam content
 *
 * Features:
 * - GitHub Flavored Markdown (tables, strikethrough, etc.)
 * - LaTeX math rendering via KaTeX
 * - Consistent styling with the application theme
 */
export const MarkdownRenderer: FC<MarkdownRendererProps> = memo(({ content, className }) => {
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
      {content}
    </ReactMarkdown>
  );
});

MarkdownRenderer.displayName = "MarkdownRenderer";
