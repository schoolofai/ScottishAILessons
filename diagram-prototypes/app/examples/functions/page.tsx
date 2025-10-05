"use client";

import Link from 'next/link';
import { JSXGraphTool } from '@/components/tools/JSXGraphTool';
import { QUADRATIC_FUNCTION } from '@/lib/example-diagrams';
import { CodePreview } from '@/components/ui/CodePreview';

export default function FunctionsPage() {
  return (
    <div className="container mx-auto p-8 max-w-5xl">
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:underline">
          ← Back to Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">Quadratic Function Prototype</h1>

      <JSXGraphTool
        args={QUADRATIC_FUNCTION}
        status={{ type: "complete" }}
      />

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">JSON Configuration</h2>
        <CodePreview
          code={JSON.stringify(QUADRATIC_FUNCTION, null, 2)}
          language="json"
        />
      </div>

      <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded">
        <h3 className="font-semibold mb-2">Learning Objectives</h3>
        <ul className="list-disc ml-6 space-y-1">
          <li>Visualize the shape of quadratic functions (parabolas)</li>
          <li>Identify the vertex as the minimum point for f(x) = x²</li>
          <li>Understand the axis of symmetry of parabolas</li>
        </ul>
      </div>
    </div>
  );
}
