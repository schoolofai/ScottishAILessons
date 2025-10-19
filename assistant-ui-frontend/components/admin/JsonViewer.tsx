'use client';

import dynamic from 'next/dynamic';

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
 */
export function JsonViewer({ data, title }: JsonViewerProps) {
  const jsonString = JSON.stringify(data, null, 2);

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
      <div className="bg-gray-100 text-gray-900 px-4 py-2 font-semibold text-sm border-b border-gray-300">
        {title}
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
