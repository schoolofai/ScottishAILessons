import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Course ID is required', statusCode: 404 },
    {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    }
  );
}