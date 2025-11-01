'use client';

import React, { useState } from 'react';
import FileBrowser from './FileBrowser';

interface ChapterUploadProps {
  seriesId: string;
  onUploadComplete?: (result: { success: boolean; chapterId?: string; webPath?: string; error?: string }) => void;
  className?: string;
  disabled?: boolean;
}

const HOST_MOUNT_PREFIX = '/host-data/';

export default function ChapterUpload({
  seriesId,
  onUploadComplete,
  className = '',
  disabled = false,
}: ChapterUploadProps) {
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterNumber, setChapterNumber] = useState('');
  const [selectedHtmlPath, setSelectedHtmlPath] = useState('');
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const resetForm = () => {
    setChapterTitle('');
    setChapterNumber('');
    setSelectedHtmlPath('');
    setStatusMessage(null);
  };

  const populateChapterFromPath = (path: string) => {
    if (!path) return;
    const fileName = path.split('/').pop();
    if (!fileName) return;

    const baseName = fileName.replace(/\.html$/i, '');
    if (!chapterTitle.trim()) {
      const chapterMatch = baseName.match(/ch(?:apter)?[\s_-]*(\d+)/i);
      if (chapterMatch) {
        setChapterNumber(chapterMatch[1]);
      }
      setChapterTitle(baseName);
    }
  };

  const handleHostFileSelect = (path: string) => {
    setSelectedHtmlPath(path);
    setShowFileBrowser(false);
    populateChapterFromPath(path);
  };

  const validateSelection = (): { isValid: boolean; error?: string } => {
    if (!selectedHtmlPath || !selectedHtmlPath.toLowerCase().endsWith('.html')) {
      return { isValid: false, error: 'Select a mokuro .html file before importing.' };
    }

    if (!selectedHtmlPath.startsWith(HOST_MOUNT_PREFIX)) {
      return {
        isValid: false,
        error: `Selected file must come from the mounted host directory (${HOST_MOUNT_PREFIX}).`,
      };
    }

    if (!chapterTitle.trim()) {
      return { isValid: false, error: 'Enter a chapter title before importing.' };
    }

    return { isValid: true };
  };

  const handleImport = async () => {
    if (disabled || isSubmitting) return;

    const validation = validateSelection();
    if (!validation.isValid) {
      setStatusMessage({ type: 'error', text: validation.error ?? 'Invalid selection' });
      onUploadComplete?.({ success: false, error: validation.error });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceHtmlPath: selectedHtmlPath,
          seriesId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Import failed: ${response.status} ${errorText}`);
      }

      const importResult = await response.json();
      if (!importResult?.webPath) {
        throw new Error('Import completed without returning a web path.');
      }

      const chapterNumberValue = chapterNumber ? Number(chapterNumber) : 1;

      const { ContentManager } = await import('@/lib/content');
      const newChapter = await ContentManager.addChapter({
        seriesId,
        chapterNumber: chapterNumberValue,
        title: chapterTitle.trim(),
        filePath: importResult.webPath,
      });

      const result = {
        success: true,
        chapterId: newChapter.id,
        webPath: importResult.webPath as string,
      };

      setStatusMessage({ type: 'success', text: 'Chapter imported successfully!' });
      onUploadComplete?.(result);
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import chapter.';
      setStatusMessage({ type: 'error', text: message });
      onUploadComplete?.({ success: false, error: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="chapter-title" className="block text-sm font-medium text-gray-700 mb-2">
              Chapter Title *
            </label>
            <input
              id="chapter-title"
              type="text"
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              placeholder="e.g., Chapter 1, Episode 5"
              disabled={disabled || isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="chapter-number" className="block text-sm font-medium text-gray-700 mb-2">
              Chapter Number (optional)
            </label>
            <input
              id="chapter-number"
              type="number"
              value={chapterNumber}
              onChange={(e) => setChapterNumber(e.target.value)}
              placeholder="1"
              disabled={disabled || isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-blue-500 mt-1" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-blue-800">File Location Requirements</h3>
              <p className="mt-2 text-sm text-blue-700">
                Mokuro assets must be available inside the Docker-mounted <code className="bg-blue-100 px-1 rounded text-xs">{HOST_MOUNT_PREFIX}</code>
                {' '}directory. Browse that location to pick the chapter&apos;s HTML file; related assets will be copied automatically.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowFileBrowser(true)}
                  disabled={disabled || isSubmitting}
                  className="inline-flex items-center px-3 py-1.5 border border-blue-200 rounded-md text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  Browse mounted files
                </button>
                {selectedHtmlPath && (
                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-md">
                    Using: {selectedHtmlPath}
                  </span>
                )}
                {selectedHtmlPath && (
                  <button
                    type="button"
                    onClick={() => setSelectedHtmlPath('')}
                    disabled={disabled || isSubmitting}
                    className="text-xs text-blue-600 underline decoration-dotted decoration-blue-400 hover:text-blue-800"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-md border text-sm ${
              statusMessage.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={resetForm}
            disabled={disabled || isSubmitting}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={
              disabled ||
              isSubmitting ||
              !selectedHtmlPath ||
              !chapterTitle.trim()
            }
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Importing...
              </>
            ) : (
              'Import Chapter'
            )}
          </button>
        </div>
      </div>

      <FileBrowser
        isOpen={showFileBrowser}
        onFileSelect={handleHostFileSelect}
        onClose={() => setShowFileBrowser(false)}
      />
    </>
  );
}