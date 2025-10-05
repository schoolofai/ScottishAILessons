#!/bin/bash

echo "🔍 Verifying diagram-prototypes setup..."
echo "========================================"

# Check critical files
CRITICAL_FILES=(
  "lib/example-diagrams.ts"
  "components/tools/JSXGraphTool.tsx"
  "app/layout.tsx"
  "app/globals.css"
  "app/page.tsx"
)

SECONDARY_FILES=(
  "components/ui/card.tsx"
  "components/ui/CodePreview.tsx"
  "app/examples/pythagorean/page.tsx"
  "app/examples/circles/page.tsx"
  "app/examples/functions/page.tsx"
  "lib/ai-generator-mock.ts"
  "app/api/generate-diagram/route.ts"
)

ALL_CRITICAL=true
ALL_SECONDARY=true

echo ""
echo "CRITICAL FILES:"
for file in "${CRITICAL_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ MISSING: $file"
    ALL_CRITICAL=false
  fi
done

echo ""
echo "SECONDARY FILES:"
for file in "${SECONDARY_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ MISSING: $file"
    ALL_SECONDARY=false
  fi
done

echo ""
echo "========================================"
if [ "$ALL_CRITICAL" = true ] && [ "$ALL_SECONDARY" = true ]; then
  echo "✅ ALL FILES PRESENT - SETUP COMPLETE!"
  echo ""
  echo "Next steps:"
  echo "1. npm install (if not done)"
  echo "2. PORT=3005 npm run dev"
  echo "3. Open http://localhost:3005"
else
  echo "❌ SOME FILES ARE MISSING"
  exit 1
fi
