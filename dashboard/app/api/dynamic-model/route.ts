import { NextResponse } from 'next/server';
import { api } from '@/lib/api/client';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestBody {
  url: string;
  method?: RequestMethod;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string | number | boolean | undefined>;
}

export async function POST(request: Request) {
  try {
    const { url, method = 'GET', headers = {}, body, params }: RequestBody = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Make the request to the external API
    const response = await api.request(method, url, {
      headers,
      data: body,
      params,
      withCredentials: false
    });

    // Return the response data
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching dynamic model:', error);
    
    // Handle different error types
    const errorResponse = {
      error: error.message || 'Failed to fetch dynamic model',
      ...(error.data && { details: error.data })
    };

    return NextResponse.json(
      errorResponse,
      { status: error.status || 500 }
    );
  }
}
