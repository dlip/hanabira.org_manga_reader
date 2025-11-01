import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedPath = searchParams.get('path') || '/host-data/manga-library';

    // Security: Restrict to the /host-data directory (mounted volume in Docker)
    const basePath = '/host-data';
    const resolvedPath = resolve(requestedPath);
    
    if (!resolvedPath.startsWith(basePath)) {
      return NextResponse.json({ error: 'Access denied - must browse within /host-data' }, { status: 403 });
    }

    const items = await readdir(resolvedPath);
    const fileItems = await Promise.all(
      items
        .filter(item => !item.startsWith('.')) // Filter hidden files
        .map(async (item) => {
          const itemPath = join(resolvedPath, item);
          const stats = await stat(itemPath);
          
          return {
            name: item,
            type: stats.isDirectory() ? 'directory' : 'file',
            path: itemPath,
            isHtmlFile: item.endsWith('.html')
          };
        })
    );

    // Add parent directory option if not at base path
    const result = [];
    if (resolvedPath !== basePath) {
      result.push({
        name: '..',
        type: 'directory',
        path: resolve(resolvedPath, '..'),
        isHtmlFile: false
      });
    }

    // Sort: directories first, then files
    const sorted = fileItems.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    result.push(...sorted);

    return NextResponse.json({ 
      files: result,
      currentPath: resolvedPath
    });
  } catch (error) {
    console.error('File browser API error:', error);
    return NextResponse.json(
      { error: 'Failed to read directory' }, 
      { status: 500 }
    );
  }
}
