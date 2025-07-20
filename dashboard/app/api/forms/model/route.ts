import { NextResponse } from 'next/server';
import { generateDefaultModel } from '@/lib/utils/form-utils';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected an object.' },
        { status: 400 }
      );
    }

    // Generate a form model from the provided data
    const model = generateDefaultModel(data);
    
    return NextResponse.json(model);
  } catch (error) {
    console.error('Error generating form model:', error);
    return NextResponse.json(
      { error: 'Failed to generate form model' },
      { status: 500 }
    );
  }
}

// Add OPTIONS method for CORS preflight
// This is necessary for cross-origin requests from the frontend
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
