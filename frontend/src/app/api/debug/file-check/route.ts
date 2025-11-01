import { NextRequest, NextResponse } from 'next/server';
import { access, constants, readdir, stat } from 'fs/promises';
import { resolve } from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    
    if (!filePath) {
      return NextResponse.json({ error: 'path parameter required' }, { status: 400 });
    }

    const cwd = process.cwd();
    const publicDir = resolve(cwd, 'public');
    const libraryDir = resolve(publicDir, 'library');
    
    // Convert web path to filesystem path
    let fsPath: string;
    if (filePath.startsWith('/library/')) {
      fsPath = resolve(publicDir, filePath.substring(1));
    } else if (filePath.startsWith('/')) {
      fsPath = resolve(publicDir, filePath.substring(1));
    } else {
      fsPath = resolve(publicDir, filePath);
    }

    let exists = false;
    let isFile = false;
    let isDir = false;
    let size = 0;
    
    try {
      await access(fsPath, constants.F_OK);
      exists = true;
      const stats = await stat(fsPath);
      isFile = stats.isFile();
      isDir = stats.isDirectory();
      size = stats.size;
    } catch {
      exists = false;
    }

    // Also check what's in the library directory
    let libraryContents: string[] = [];
    try {
      libraryContents = await readdir(libraryDir);
    } catch {
      libraryContents = ['Directory not found'];
    }

    // Check what's in the public directory
    let publicContents: string[] = [];
    try {
      publicContents = await readdir(publicDir);
    } catch {
      publicContents = ['Directory not found'];
    }

    return NextResponse.json({
      success: true,
      debug: {
        requestedPath: filePath,
        resolvedFsPath: fsPath,
        workingDirectory: cwd,
        publicDirectory: publicDir,
        libraryDirectory: libraryDir,
        file: {
          exists,
          isFile,
          isDirectory: isDir,
          size
        },
        directoryContents: {
          public: publicContents,
          library: libraryContents
        }
      }
    });

  } catch (error) {
    console.error('File check API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}