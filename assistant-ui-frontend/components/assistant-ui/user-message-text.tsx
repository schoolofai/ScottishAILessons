"use client";

import { useContentPartText } from "@assistant-ui/react";
import { MarkdownText } from "./markdown-text";
import { HtmlMessageRenderer } from "../ui/html-message-renderer";

/**
 * Smart text renderer for user messages
 *
 * Detects if content is HTML (from rich text editor) or plain text/markdown
 * and renders appropriately to prevent raw HTML tags from showing.
 */
export const UserMessageText = () => {
  const { text } = useContentPartText();

  // Detect if content is HTML from Tiptap editor
  // Backend prepends "Your Answer: " to HTML, so check for HTML tags anywhere in text
  // Look for common HTML tags from Tiptap: <p>, <strong>, <em>, <ul>, <ol>, <img>, etc.
  const hasHtmlTags = /<(p|div|span|strong|em|u|s|ul|ol|li|img|br|h[1-6])[>\s]/.test(text);

  if (hasHtmlTags) {
    // Extract just the HTML portion after "Your Answer: " prefix if present
    const htmlContent = text.replace(/^Your Answer:\s*/, '');

    // Render HTML content with sanitization
    return <HtmlMessageRenderer htmlContent={htmlContent} />;
  }

  // Render plain text or markdown
  return <MarkdownText />;
};
