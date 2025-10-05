import Link from 'next/link';

export default function GeometryPage() {
  return (
    <div className="container mx-auto p-8 max-w-5xl">
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:underline">
          ← Back to Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">General Geometry Examples</h1>

      <div className="p-8 bg-yellow-50 border border-yellow-200 rounded text-center">
        <h2 className="text-xl font-semibold mb-4">🔜 Coming Soon</h2>
        <p className="text-gray-600 mb-4">
          This section will include advanced geometry examples:
        </p>
        <ul className="text-left max-w-md mx-auto space-y-2">
          <li>• Regular polygons (triangles, squares, hexagons)</li>
          <li>• Geometric transformations (rotation, translation, reflection)</li>
          <li>• Constructions (perpendicular bisectors, angle bisectors)</li>
          <li>• Advanced angle relationships</li>
        </ul>
      </div>
    </div>
  );
}
