import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function HomePage() {
  const examples = [
    {
      title: "Pythagorean Theorem",
      description: "Interactive right triangle demonstrating a² + b² = c²",
      href: "/examples/pythagorean",
      status: "✅ Working",
      complexity: "Medium"
    },
    {
      title: "Interactive Circles",
      description: "Draggable circle with dynamic radius, area, and circumference",
      href: "/examples/circles",
      status: "✅ Working",
      complexity: "Easy"
    },
    {
      title: "Function Graphs",
      description: "Quadratic, trigonometric, and custom function plotting",
      href: "/examples/functions",
      status: "✅ Working",
      complexity: "Medium"
    },
    {
      title: "General Geometry",
      description: "Polygons, angles, transformations, and constructions",
      href: "/examples/geometry",
      status: "🔜 Planned",
      complexity: "Hard"
    }
  ];

  return (
    <main className="container mx-auto p-8 max-w-6xl">
      <header className="mb-12">
        <h1 className="text-4xl font-bold mb-4">
          🎨 Interactive Diagram Prototyping Lab
        </h1>
        <p className="text-lg text-gray-600">
          JSON-driven JSXGraph diagrams for AI-generated lesson content
        </p>
      </header>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Approach: Declarative JSON</h2>
        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded">
          <p className="mb-2">
            <strong>Key Innovation:</strong> AI backends generate structured JSON that maps
            directly to JSXGraph&apos;s API, no code generation required.
          </p>
          <code className="text-sm bg-white p-2 rounded block mt-3">
            {`{ "type": "point", "args": [0, 0], "attributes": { "name": "A" } }`}
          </code>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-6">Examples</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {examples.map((example) => (
            <Link key={example.href} href={example.href}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <CardTitle>{example.title}</CardTitle>
                    <span className="text-sm">{example.status}</span>
                  </div>
                  <CardDescription>{example.description}</CardDescription>
                  <div className="mt-3 text-xs text-gray-500">
                    Complexity: {example.complexity}
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12 p-6 bg-yellow-50 border border-yellow-200 rounded">
        <h3 className="font-semibold mb-2">🎯 Future Tools (Comparison Planned)</h3>
        <ul className="space-y-1 text-sm">
          <li>• <strong>GeoGebra</strong> - Comprehensive math software (heavier, feature-rich)</li>
          <li>• <strong>Asymptote</strong> - LaTeX-quality vector graphics (server-side)</li>
          <li>• <strong>Manim</strong> - Mathematical animations (Python-based)</li>
        </ul>
      </section>
    </main>
  );
}
