import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile, readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';
import AdmZip from 'adm-zip';

// Configure API route for large file uploads
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large file processing
export const dynamic = 'force-dynamic';

interface UploadedFile {
  name: string;
  data: Buffer;
  size: number;
}

async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

async function generateChapterId(seriesId: string, chapterTitle?: string): Promise<string> {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const titlePart = chapterTitle ? 
    chapterTitle.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20) : 
    'chapter';
  return `${titlePart}_${timestamp}_${randomId}`;
}

async function validateMokuroFiles(dirPath: string): Promise<{ isValid: boolean; htmlFile?: string; mokuroFile?: string; imageDir?: string }> {
  try {
    const files = await readdir(dirPath);
    
    let htmlFile: string | undefined;
    let mokuroFile: string | undefined;
    let imageDir: string | undefined;
    
    for (const file of files) {
      const filePath = join(dirPath, file);
      const fileStat = await stat(filePath);
      
      if (fileStat.isFile()) {
        if (file.endsWith('.html')) {
          htmlFile = file;
        } else if (file.endsWith('.mokuro')) {
          mokuroFile = file;
        }
      } else if (fileStat.isDirectory()) {
        // Check if directory contains image files
        const subFiles = await readdir(filePath);
        const hasImages = subFiles.some(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
        if (hasImages) {
          imageDir = file;
        }
      }
    }
    
    return {
      isValid: !!(htmlFile && mokuroFile),
      htmlFile,
      mokuroFile,
      imageDir
    };
  } catch {
    return { isValid: false };
  }
}

async function extractZipFile(zipBuffer: Buffer, extractPath: string): Promise<string[]> {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const extractedFiles: string[] = [];
  
  await ensureDirectoryExists(extractPath);
  
  for (const entry of entries) {
    if (!entry.isDirectory) {
      const entryPath = join(extractPath, entry.entryName);
      const entryDir = resolve(entryPath, '..');
      
      await ensureDirectoryExists(entryDir);
      await writeFile(entryPath, entry.getData());
      extractedFiles.push(entry.entryName);
    }
  }
  
  return extractedFiles;
}

// Parse multipart form data manually to handle large files
async function parseMultipartFormData(request: NextRequest): Promise<{ fields: Map<string, string>; files: UploadedFile[] }> {
  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.includes('multipart/form-data')) {
    throw new Error('Invalid content type');
  }

  const boundaryMatch = contentType.match(/boundary=(.+)/);
  if (!boundaryMatch) {
    throw new Error('No boundary found');
  }

  const boundary = '--' + boundaryMatch[1];
  const reader = request.body?.getReader();
  if (!reader) {
    throw new Error('No request body');
  }

  const fields = new Map<string, string>();
  const files: UploadedFile[] = [];

  try {
    // Read the entire body in chunks
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      totalSize += value.length;
      
      // Check size limit (500MB)
      if (totalSize > 500 * 1024 * 1024) {
        throw new Error('Request too large');
      }
    }

    // Combine all chunks into a single buffer
    const buffer = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Parse the multipart data
    const data = buffer;
    const boundaryBytes = new TextEncoder().encode(boundary);
    
    let start = 0;
    while (start < data.length) {
      // Find next boundary
      let boundaryIndex = -1;
      for (let i = start; i <= data.length - boundaryBytes.length; i++) {
        let match = true;
        for (let j = 0; j < boundaryBytes.length; j++) {
          if (data[i + j] !== boundaryBytes[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          boundaryIndex = i;
          break;
        }
      }

      if (boundaryIndex === -1) break;

      // Move to after boundary
      start = boundaryIndex + boundaryBytes.length;
      
      // Skip CRLF after boundary
      if (start < data.length && data[start] === 0x0D) start++;
      if (start < data.length && data[start] === 0x0A) start++;

      // Find double CRLF (end of headers)
      let headerEnd = -1;
      for (let i = start; i < data.length - 3; i++) {
        if (data[i] === 0x0D && data[i + 1] === 0x0A && data[i + 2] === 0x0D && data[i + 3] === 0x0A) {
          headerEnd = i;
          break;
        }
      }

      if (headerEnd === -1) break;

      // Parse headers
      const headerText = new TextDecoder().decode(data.slice(start, headerEnd));
      const headers = new Map<string, string>();
      
      for (const line of headerText.split('\r\n')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim().toLowerCase();
          const value = line.slice(colonIndex + 1).trim();
          headers.set(key, value);
        }
      }

      // Get content disposition
      const contentDisposition = headers.get('content-disposition');
      if (!contentDisposition) continue;

      const nameMatch = contentDisposition.match(/name="([^"]+)"/);
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      
      if (!nameMatch) continue;

      const fieldName = nameMatch[1];
      const filename = filenameMatch?.[1];

      // Find content start and end
      const contentStart = headerEnd + 4;
      
      // Find next boundary to determine content end
      let contentEnd = data.length;
      for (let i = contentStart; i <= data.length - boundaryBytes.length; i++) {
        let match = true;
        for (let j = 0; j < boundaryBytes.length; j++) {
          if (data[i + j] !== boundaryBytes[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          contentEnd = i - 2; // Account for CRLF before boundary
          break;
        }
      }

      const content = data.slice(contentStart, contentEnd);

      if (filename) {
        // It's a file
        files.push({
          name: filename,
          data: Buffer.from(content),
          size: content.length
        });
      } else {
        // It's a regular field
        const value = new TextDecoder().decode(content);
        fields.set(fieldName, value);
      }

      start = contentEnd + 2; // Move past the CRLF
    }

    return { fields, files };

  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('Chunked upload API called - TOP OF HANDLER');
  
  try {
    console.log('Parsing multipart form data manually...');
    const { fields, files } = await parseMultipartFormData(request);
    
    const seriesId = fields.get('seriesId');
    const chapterTitle = fields.get('chapterTitle');
    const chapterNumber = fields.get('chapterNumber');
    
    console.log('Parsed form data:', {
      seriesId,
      chapterTitle,
      chapterNumber,
      filesCount: files.length,
      fileNames: files.map(f => f.name),
      fileSizes: files.map(f => f.size)
    });
    
    if (!seriesId) {
      console.error('Missing seriesId');
      return NextResponse.json({ success: false, error: 'Series ID is required' }, { status: 400 });
    }
    
    if (files.length === 0) {
      console.error('No files provided');
      return NextResponse.json({ success: false, error: 'No files provided' }, { status: 400 });
    }
    
    // Generate chapter ID
    const chapterId = await generateChapterId(seriesId, chapterTitle);
    const chapterDir = resolve(process.cwd(), 'public', 'library', seriesId, chapterId);
    
    await ensureDirectoryExists(chapterDir);
    
    const processedFiles: string[] = [];
    
    // Process each uploaded file
    for (const file of files) {
      if (file.name.endsWith('.zip')) {
        // Handle zip file
        console.log(`Extracting zip file: ${file.name}`);
        const extractedFiles = await extractZipFile(file.data, chapterDir);
        processedFiles.push(...extractedFiles);
      } else {
        // Handle individual file
        const filePath = join(chapterDir, file.name);
        await writeFile(filePath, file.data);
        processedFiles.push(file.name);
      }
    }
    
    // Validate that we have the required mokuro files
    const validation = await validateMokuroFiles(chapterDir);
    if (!validation.isValid) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid mokuro chapter. Required files: .html and .mokuro files' 
      }, { status: 400 });
    }
    
    // Create chapter metadata file
    const chapterMetadata = {
      id: chapterId,
      seriesId,
      title: chapterTitle || `Chapter ${chapterNumber || 'Unknown'}`,
      chapterNumber: chapterNumber ? parseInt(chapterNumber) : undefined,
      htmlFile: validation.htmlFile,
      mokuroFile: validation.mokuroFile,
      imageDir: validation.imageDir,
      createdAt: new Date().toISOString(),
      files: processedFiles
    };
    
    const metadataPath = join(chapterDir, 'chapter-metadata.json');
    await writeFile(metadataPath, JSON.stringify(chapterMetadata, null, 2));
    
    return NextResponse.json({ 
      success: true, 
      chapterId,
      files: processedFiles,
      metadata: chapterMetadata
    });
    
  } catch (error) {
    console.error('Error processing chunked upload:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (errorMessage.includes('too large') || errorMessage.includes('Request too large')) {
      return NextResponse.json({ 
        success: false, 
        error: 'File too large: Maximum allowed size is 500MB. Try compressing images or splitting into smaller files.' 
      }, { status: 413 });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}