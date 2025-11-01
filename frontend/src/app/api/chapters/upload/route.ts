import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile, readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';
import AdmZip from 'adm-zip';

// Configure API route for large file uploads
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large file processing

// Configure route segment options for large uploads
export const dynamic = 'force-dynamic';
export const preferredRegion = 'auto';

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

// copyDirectory function removed as it's not used in current implementation

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('Upload API called');
  
  // Check content length
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const sizeMB = parseInt(contentLength) / (1024 * 1024);
    console.log(`Request content-length: ${sizeMB.toFixed(2)}MB`);
    
    // Allow up to 500MB
    if (parseInt(contentLength) > 500 * 1024 * 1024) {
      return NextResponse.json({ 
        success: false, 
        error: `File too large: ${sizeMB.toFixed(2)}MB. Maximum allowed is 500MB.` 
      }, { status: 413 });
    }
  }
  
  try {
    console.log('Parsing form data...');
    let formData;
    try {
      formData = await request.formData();
      console.log('Form data parsed successfully');
    } catch (parseError) {
      console.error('Failed to parse form data:', parseError);
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
      
      // Check if it's a body size error
      if (errorMessage.toLowerCase().includes('body') || errorMessage.toLowerCase().includes('size') || errorMessage.toLowerCase().includes('large')) {
        return NextResponse.json({ 
          success: false, 
          error: 'File too large for server to process. Try compressing the images or splitting into smaller files.' 
        }, { status: 413 });
      }
      
      return NextResponse.json({ 
        success: false, 
        error: `Failed to parse form data: ${errorMessage}` 
      }, { status: 400 });
    }
    const seriesId = formData.get('seriesId') as string;
    const chapterTitle = formData.get('chapterTitle') as string;
    const chapterNumber = formData.get('chapterNumber') as string;
    const files = formData.getAll('files') as File[];
    
    console.log('Received upload request:', {
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
      const fileName = file.name;
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      
      if (fileName.endsWith('.zip')) {
        // Handle zip file
        console.log(`Extracting zip file: ${fileName}`);
        const extractedFiles = await extractZipFile(fileBuffer, chapterDir);
        processedFiles.push(...extractedFiles);
      } else {
        // Handle individual file
        const filePath = join(chapterDir, fileName);
        await writeFile(filePath, fileBuffer);
        processedFiles.push(fileName);
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
    console.error('Error processing chapter upload:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const seriesId = searchParams.get('seriesId');
    
    if (!seriesId) {
      return NextResponse.json({ error: 'Series ID is required' }, { status: 400 });
    }
    
    const seriesDir = resolve(process.cwd(), 'public', 'library', seriesId);
    
    try {
      const chapters = await readdir(seriesDir);
      const chapterList = [];
      
      for (const chapterDir of chapters) {
        const chapterPath = join(seriesDir, chapterDir);
        const chapterStat = await stat(chapterPath);
        
        if (chapterStat.isDirectory()) {
          const metadataPath = join(chapterPath, 'chapter-metadata.json');
          
          try {
            const metadataContent = await readdir(chapterPath);
            if (metadataContent.includes('chapter-metadata.json')) {
              const { readFile } = await import('fs/promises');
              const metadata = JSON.parse(await readFile(metadataPath, 'utf-8'));
              chapterList.push(metadata);
            } else {
              // Legacy chapter without metadata
              chapterList.push({
                id: chapterDir,
                seriesId,
                title: chapterDir,
                htmlFile: metadataContent.find(f => f.endsWith('.html')),
                mokuroFile: metadataContent.find(f => f.endsWith('.mokuro'))
              });
            }
          } catch (error) {
            console.warn(`Error reading metadata for chapter ${chapterDir}:`, error);
          }
        }
      }
      
      // Sort by chapter number or creation date
      chapterList.sort((a, b) => {
        if (a.chapterNumber && b.chapterNumber) {
          return a.chapterNumber - b.chapterNumber;
        }
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });
      
      return NextResponse.json({ chapters: chapterList });
      
    } catch {
      // Series directory doesn't exist yet
      return NextResponse.json({ chapters: [] });
    }
    
  } catch (error) {
    console.error('Error fetching chapters:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
}