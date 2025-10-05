"use client";

import Link from 'next/link';
import { JSXGraphTool } from '@/components/tools/JSXGraphTool';
import { INTERACTIVE_CIRCLE } from '@/lib/example-diagrams';
import { CodePreview } from '@/components/ui/CodePreview';

export default function CirclesPage() {
  return (
    <div className="container mx-auto p-8 max-w-5xl">
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:underline">
          ← Back to Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">Interactive Circle Prototype</h1>

      <JSXGraphTool
        args={INTERACTIVE_CIRCLE}
        status={{ type: "complete" }}
      />

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">JSON Configuration</h2>
        <CodePreview
          code={JSON.stringify(INTERACTIVE_CIRCLE, null, 2)}
          language="json"
        />
      </div>

      <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded">
        <h3 className="font-semibold mb-2">Learning Objectives</h3>
        <ul className="list-disc ml-6 space-y-1">
          <li>Understand the relationship between radius and circle properties</li>
          <li>Explore how area and circumference change with radius</li>
          <li>Practice interactive manipulation of geometric objects</li>
        </ul>
      </div>
    </div>
  );
}
