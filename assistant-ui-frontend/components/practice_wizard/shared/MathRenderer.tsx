"use client";

/**
 * MathRenderer - Shared component for rendering markdown with math support
 *
 * Uses remark-math and rehype-katex for LaTeX rendering.
 * Handles both inline and display math.
 */

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

interface MathRendererProps {
  content: string;
  className?: string;
  /** Whether to process \n literals into line breaks */
  processNewlines?: boolean;
}

/**
 * Process content while preserving markdown table structure.
 * Tables require consecutive lines - cannot have blank lines between rows.
 */
function processContentForMarkdown(content: string): string {
  // Type guard: ensure content is a string
  if (typeof content !== "string") {
    console.error(
      "%o\n\n%s",
      content,
      `MathRenderer received non-string content (type: ${typeof content}). Converting to string.`
    );
    // Convert to string representation
    if (content === null || content === undefined) {
      return "";
    }
    if (typeof content === "object") {
      // Handle objects that might have a text property
      const obj = content as Record<string, unknown>;
      if ("text" in obj && typeof obj.text === "string") {
        return obj.text;
      }
      return JSON.stringify(content);
    }
    return String(content);
  }

  // First, convert literal "\n" strings to actual newlines
  let processed = content.replace(/\\n/g, "\n");

  // Split into lines to identify table blocks
  const lines = processed.split("\n");
  const result: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect table rows (start with | or are separator rows like |---|)
    const isTableRow = trimmed.startsWith("|") || /^\|[-:|\s]+\|$/.test(trimmed);

    if (isTableRow) {
      if (!inTable) {
        // Starting a new table - add blank line before if there's content
        if (result.length > 0 && result[result.length - 1].trim() !== "") {
          result.push("");
        }
        inTable = true;
      }
      // Add table row without extra blank lines
      result.push(line);
    } else {
      if (inTable) {
        // Leaving table - add blank line after
        result.push("");
        inTable = false;
      }

      // For non-table content, add blank line for paragraph breaks
      // but only if previous line wasn't empty and this line has content
      if (trimmed !== "") {
        if (result.length > 0 && result[result.length - 1].trim() !== "" && !result[result.length - 1].trim().startsWith("|")) {
          result.push("");
        }
        result.push(line);
      } else if (result.length > 0 && result[result.length - 1].trim() !== "") {
        // Preserve intentional blank lines
        result.push("");
      }
    }
  }

  return result.join("\n");
}

export function MathRenderer({
  content,
  className,
  processNewlines = true,
}: MathRendererProps) {
  // Process content for proper markdown rendering
  let processedContent = content;

  if (processNewlines) {
    processedContent = processContentForMarkdown(content);
  }

  return (
    <div className={cn("prose prose-sm max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          table: ({ className: tableClass, ...props }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-gray-200">
              <table
                className={cn(
                  "w-full border-collapse text-sm",
                  tableClass
                )}
                {...props}
              />
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50 border-b border-gray-200">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-gray-200">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-gray-50 transition-colors">{children}</tr>
          ),
          th: ({ className: thClass, ...props }) => (
            <th
              className={cn(
                "px-4 py-3 text-left font-semibold text-gray-700 bg-gray-100",
                thClass
              )}
              {...props}
            />
          ),
          td: ({ className: tdClass, ...props }) => (
            <td
              className={cn(
                "px-4 py-3 text-left text-gray-600",
                tdClass
              )}
              {...props}
            />
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

export default MathRenderer;
