'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Dynamically import to avoid SSR issues with react-syntax-highlighter
const SyntaxHighlighter = dynamic(
  () => import('react-syntax-highlighter').then(mod => mod.Prism),
  { ssr: false, loading: () => <pre className="text-sm text-gray-800 p-4">Loading...</pre> }
);

interface JsonViewerProps {
  data: any;
  title: string;
}

/**
 * Component for displaying JSON with syntax highlighting
 * Uses react-syntax-highlighter with custom light theme styling
 * Includes copy-to-clipboard functionality
 */
export function JsonViewer({ data, title }: JsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(data, null, 2);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      toast.success('JSON copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
      throw new Error('Failed to copy JSON to clipboard');
    }
  }

  // Custom light theme - readable light background with dark text
  const lightTheme = {
    'code[class*="language-"]': {
      color: '#24292e',
      backgroundColor: '#ffffff'
    },
    'pre[class*="language-"]': {
      backgroundColor: '#ffffff',
      color: '#24292e'
    },
    'pre': {
      backgroundColor: '#ffffff'
    },
    'string': {
      color: '#6f42c1' // Purple for strings
    },
    'number': {
      color: '#005cc5' // Blue for numbers
    },
    'literal': {
      color: '#d73a49' // Red for booleans/null
    },
    'attr-name': {
      color: '#6f42c1' // Purple for keys
    },
    'punctuation': {
      color: '#24292e' // Dark for punctuation
    },
    'operator': {
      color: '#24292e'
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="bg-gray-100 text-gray-900 px-4 py-2 font-semibold text-sm border-b border-gray-300 flex items-center justify-between">
        <span>{title}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2 text-gray-600 hover:text-gray-900"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="ml-1 text-xs">{copied ? 'Copied!' : 'Copy'}</span>
        </Button>
      </div>
      <div className="max-h-[600px] overflow-auto">
        <SyntaxHighlighter
          language="json"
          style={lightTheme as any}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: '13px',
            lineHeight: '1.5',
            backgroundColor: '#ffffff',
            color: '#24292e'
          }}
          wrapLines={true}
          wrapLongLines={true}
        >
          {jsonString}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
