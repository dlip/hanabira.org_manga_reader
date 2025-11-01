import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'Chunked upload endpoint is available',
    timestamp: new Date().toISOString() 
  });
}