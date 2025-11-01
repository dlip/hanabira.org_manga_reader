import { NextRequest, NextResponse } from 'next/server';

// Test endpoint to check body size limits
export const maxDuration = 300;
export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const contentLength = request.headers.get('content-length');
    console.log('Test upload - Content-Length:', contentLength);
    
    if (contentLength) {
      const sizeMB = parseInt(contentLength) / (1024 * 1024);
      console.log(`Test upload size: ${sizeMB.toFixed(2)}MB`);
    }
    
    // Try to read a small chunk first
    const reader = request.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: 'No body' }, { status: 400 });
    }
    
    let totalSize = 0;
    const maxChunks = 10; // Only read first 10 chunks as test
    let chunkCount = 0;
    
    try {
      while (chunkCount < maxChunks) {
        const { done, value } = await reader.read();
        if (done) break;
        
        totalSize += value?.length || 0;
        chunkCount++;
        
        // Log progress
        console.log(`Read chunk ${chunkCount}, total so far: ${totalSize} bytes`);
      }
      
      return NextResponse.json({
        success: true,
        chunksRead: chunkCount,
        bytesRead: totalSize,
        contentLength: contentLength,
        message: 'Body reading test successful'
      });
      
    } finally {
      reader.releaseLock();
    }
    
  } catch (error) {
    console.error('Test upload error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}