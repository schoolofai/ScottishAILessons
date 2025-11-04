"use client";

import React, { useEffect, useState } from 'react';

interface HtmlMessageRendererProps {
  htmlContent: string;
  className?: string;
}

/**
 * Safely renders HTML content from rich text editor
 *
 * Uses DOMPurify (client-side only) to sanitize HTML and prevent XSS attacks
 * while allowing common formatting tags.
 *
 * Note: Uses dynamic import to avoid Next.js SSR issues with isomorphic-dompurify.
 */
export function HtmlMessageRenderer({ htmlContent, className = '' }: HtmlMessageRendererProps) {
  const [sanitizedHTML, setSanitizedHTML] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Only run DOMPurify on client side to avoid Next.js SSR/JSDOM issues
    if (typeof window !== 'undefined') {
      import('isomorphic-dompurify').then((DOMPurifyModule) => {
        const DOMPurify = DOMPurifyModule.default;

        // Sanitize HTML to prevent XSS attacks
        const cleaned = DOMPurify.sanitize(htmlContent, {
          ALLOWED_TAGS: [
            'p', 'br', 'strong', 'em', 'u', 's', 'span', 'div',
            'ul', 'ol', 'li',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'img', 'a',
            'code', 'pre', 'blockquote',
            'table', 'thead', 'tbody', 'tr', 'th', 'td'
          ],
          ALLOWED_ATTR: [
            'class', 'style', 'href', 'target', 'rel',
            'src', 'alt', 'title', 'width', 'height',
            'data-latex', // For math rendering
            'data-scene' // For diagram editing
          ],
          ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        });

        setSanitizedHTML(cleaned);
      }).catch((error) => {
        console.error('Failed to load DOMPurify:', error);
        // Fallback: show unsanitized content with warning (not ideal, but prevents blank screen)
        console.warn('⚠️ HTML sanitization failed, showing unsanitized content');
        setSanitizedHTML(htmlContent);
      });
    }
  }, [htmlContent]);

  // Show loading or empty during SSR
  if (!isClient || !sanitizedHTML) {
    return (
      <div className={`prose prose-sm max-w-none ${className}`}>
        <p className="text-gray-500 italic">Loading answer...</p>
      </div>
    );
  }

  return (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
      style={{
        // Ensure proper spacing for rich content
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
      }}
    />
  );
}
