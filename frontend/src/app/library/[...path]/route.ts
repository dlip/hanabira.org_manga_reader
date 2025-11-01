import { NextRequest, NextResponse } from 'next/server';
import { resolve } from 'path';
import { stat, readFile } from 'fs/promises';

const PUBLIC_DIR = resolve(process.cwd(), 'public');
const LIBRARY_ROOT = resolve(PUBLIC_DIR, 'library');

function guessContentType(file: string): string {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.mokuro')) return 'application/json; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  if (file.endsWith('.webp')) return 'image/webp';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

// Explicit dynamic handling – runtime access to filesystem
export const dynamic = 'force-dynamic';

type RouteParams = { path?: string[] };

export async function GET(_req: NextRequest, context: { params: RouteParams } | { params: Promise<RouteParams> }) {
  try {
    const rawParams = 'params' in context ? context.params : {};
    const resolvedParams: RouteParams = rawParams instanceof Promise ? await rawParams : rawParams;
    const segments = resolvedParams.path || [];
    if (segments.length === 0) {
      return NextResponse.json({ error: 'No path specified' }, { status: 400 });
    }
    // Prevent traversal / invalid segments
    if (segments.some(seg => seg === '..' || seg.includes('..') || seg.includes('\\'))) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }
    const fsPath = resolve(LIBRARY_ROOT, ...segments);
    if (!fsPath.startsWith(LIBRARY_ROOT)) {
      return NextResponse.json({ error: 'Path outside library root' }, { status: 403 });
    }
    let st;
    try {
      st = await stat(fsPath);
    } catch {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (!st.isFile()) {
      return NextResponse.json({ error: 'Not a file' }, { status: 400 });
    }
    const data = await readFile(fsPath);
    const headers = new Headers();
    headers.set('Content-Type', guessContentType(fsPath));
    headers.set('Cache-Control', 'public, max-age=60');
    // Ensure proper body type for Response
    return new NextResponse(new Uint8Array(data), { status: 200, headers });
  } catch (e) {
    console.error('[dynamic library route] error', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
