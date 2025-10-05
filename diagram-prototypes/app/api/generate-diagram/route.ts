import { NextRequest, NextResponse } from 'next/server';
import { generateDiagramFromPrompt } from '@/lib/ai-generator-mock';

export async function POST(request: NextRequest) {
  const { prompt } = await request.json();

  // Simulate AI processing delay
  await new Promise(resolve => setTimeout(resolve, 500));

  const diagram = generateDiagramFromPrompt(prompt);

  return NextResponse.json({
    success: true,
    diagram,
    metadata: {
      generatedAt: new Date().toISOString(),
      processingTime: "500ms"
    }
  });
}
