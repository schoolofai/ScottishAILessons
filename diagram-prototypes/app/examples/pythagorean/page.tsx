"use client";

import Link from 'next/link';
import { JSXGraphTool } from '@/components/tools/JSXGraphTool';
import { PYTHAGOREAN_THEOREM } from '@/lib/example-diagrams';
import { CodePreview } from '@/components/ui/CodePreview';

export default function PythagoreanPage() {
  return (
    <div className="container mx-auto p-8 max-w-5xl">
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:underline">
          ← Back to Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">Pythagorean Theorem Prototype</h1>

      <JSXGraphTool
        args={PYTHAGOREAN_THEOREM}
        status={{ type: "complete" }}
      />

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">JSON Configuration</h2>
        <CodePreview
          code={JSON.stringify(PYTHAGOREAN_THEOREM, null, 2)}
          language="json"
        />
      </div>

      <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded">
        <h3 className="font-semibold mb-2">Learning Objectives</h3>
        <ul className="list-disc ml-6 space-y-1">
          <li>Understand the Pythagorean theorem: a² + b² = c²</li>
          <li>Visualize how the theorem holds for any right triangle</li>
          <li>Explore the relationship by dragging points interactively</li>
        </ul>
      </div>
    </div>
  );
}
