'use client';

import dynamic from 'next/dynamic';
import remarkGfm from 'remark-gfm';

// Dynamically import to avoid SSR issues
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false });

interface MarkdownPreviewProps {
  markdown: string;
  title: string;
}

/**
 * Component for displaying markdown with GitHub-flavored markdown support
 */
export function MarkdownPreview({ markdown, title }: MarkdownPreviewProps) {
  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="bg-blue-600 text-white px-4 py-2 font-semibold text-sm border-b border-blue-700">
        {title}
      </div>
      <div className="p-6 max-h-[600px] overflow-auto prose prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={['script']}>
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
