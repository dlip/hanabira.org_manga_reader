import { NextRequest, NextResponse } from 'next/server';
import { basename, dirname, join, resolve } from 'path';
import { access, constants, mkdir, readdir, copyFile, stat } from 'fs/promises';

async function pathExists(p: string) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function copyDir(src: string, dest: string) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else if (entry.isFile()) {
      await copyFile(s, d);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sourceHtmlPath: string = body.sourceHtmlPath;
    const seriesId: string = body.seriesId;
    const chapterFolderFromClient: string | undefined = body.chapterFolder;

    if (!sourceHtmlPath || !seriesId) {
      return NextResponse.json({ error: 'sourceHtmlPath and seriesId are required' }, { status: 400 });
    }

    // Validate seriesId is a UUID to prevent invalid directory structures
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_PATTERN.test(seriesId)) {
      return NextResponse.json({ 
        error: `Invalid seriesId format: "${seriesId}". Must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)` 
      }, { status: 400 });
    }

    console.log('[import] Importing file:', sourceHtmlPath);
    console.log('[import] Series ID:', seriesId);
    console.log('[import] Process CWD:', process.cwd());
    
    // Use the path as-is if it's already absolute (starts with /)
    // Otherwise resolve it relative to process.cwd()
    const resolvedSrcHtml = sourceHtmlPath.startsWith('/') 
      ? sourceHtmlPath 
      : resolve(process.cwd(), sourceHtmlPath);
    
    console.log('[import] Resolved source path:', resolvedSrcHtml);
    
    // Basic security: prevent path traversal attacks
    if (sourceHtmlPath.includes('..')) {
      return NextResponse.json({ 
        error: 'Invalid path: path traversal not allowed' 
      }, { status: 403 });
    }

    // Check if file exists
    if (!(await pathExists(resolvedSrcHtml))) {
      return NextResponse.json({ 
        error: `Source HTML file does not exist: ${resolvedSrcHtml}` 
      }, { status: 404 });
    }

    // Verify it's a file
    try {
      const st = await stat(resolvedSrcHtml);
      if (!st.isFile()) {
        return NextResponse.json({ error: 'Provided path is not a file' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Unable to stat source file' }, { status: 500 });
    }

    const srcDir = dirname(resolvedSrcHtml);
    const htmlName = basename(resolvedSrcHtml);
    const baseNameNoExt = htmlName.replace(/\.html?$/i, '');

    // Determine destination folder inside Next public
    const chapterFolder = chapterFolderFromClient && chapterFolderFromClient.trim().length > 0
      ? chapterFolderFromClient
      : `${baseNameNoExt}-${Math.random().toString(36).slice(2,8)}`;

    const destRoot = resolve(process.cwd(), 'public', 'library', seriesId, chapterFolder);
    await mkdir(destRoot, { recursive: true });

    // Copy HTML file
    await copyFile(resolvedSrcHtml, join(destRoot, htmlName));

    // Copy .mokuro with same basename if exists
    const mokuroPath = join(srcDir, `${baseNameNoExt}.mokuro`);
    if (await pathExists(mokuroPath)) {
      await copyFile(mokuroPath, join(destRoot, `${baseNameNoExt}.mokuro`));
    }

    // Copy _ocr directory if present (full directory)
    const ocrDir = join(srcDir, '_ocr');
    if (await pathExists(ocrDir)) {
      await copyDir(ocrDir, join(destRoot, '_ocr'));
    }

    // Copy sibling image folder named like the html base (e.g., 'test' for 'test.html')
    const imagesDir = join(srcDir, baseNameNoExt);
    if (await pathExists(imagesDir)) {
      await copyDir(imagesDir, join(destRoot, baseNameNoExt));
    }

    const webPath = `/library/${seriesId}/${chapterFolder}/${htmlName}`;
    
    console.log('🔍 Import API - File paths:', {
      resolvedSrcHtml,
      srcDir,
      htmlName,
      baseNameNoExt,
      chapterFolder,
      destRoot,
      webPath,
      processWorkingDir: process.cwd(),
      publicDir: resolve(process.cwd(), 'public'),
      libraryDir: resolve(process.cwd(), 'public', 'library')
    });
    
    return NextResponse.json({ webPath });
  } catch (error) {
    console.error('Import API error:', error);
    return NextResponse.json({ error: 'Failed to import chapter files' }, { status: 500 });
  }
}
