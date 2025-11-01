'use client';

import React, { useState, useEffect } from 'react';

interface FileBrowserProps {
  onFileSelect: (filePath: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

interface FileItem {
  name: string;
  type: 'file' | 'directory';
  path: string;
  isHtmlFile?: boolean;
}

export default function FileBrowser({ onFileSelect, onClose, isOpen }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState('/host-data/manga-library');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = async (path: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch files');
      }
      
      setFiles(data.files);
      setCurrentPath(data.currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
      console.error('Error fetching files:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    // Fetch whenever dialog opens or path changes
    fetchFiles(currentPath);
  }, [isOpen, currentPath]);

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'directory') {
      fetchFiles(item.path);
    } else if (item.name.endsWith('.html')) {
      onFileSelect(item.path);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[70vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Select Mokuro HTML File</h3>
            <p className="text-sm text-gray-600 mt-1">Current: {currentPath}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800 text-xl"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading files...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-600 mb-2">Error: {error}</div>
              <button
                onClick={() => fetchFiles(currentPath)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {files.map((item) => (
                <div
                  key={item.path}
                  onClick={() => handleItemClick(item)}
                  className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                    item.type === 'directory'
                      ? 'hover:bg-blue-50 text-blue-700'
                      : item.name.endsWith('.html')
                      ? 'hover:bg-green-50 text-green-700'
                      : 'hover:bg-gray-50 text-gray-500'
                  }`}
                >
                  <div className="mr-3">
                    {item.type === 'directory' ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    {item.name.endsWith('.html') && (
                      <div className="text-xs text-gray-500">Mokuro HTML file</div>
                    )}
                  </div>
                  {item.type === 'directory' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            <strong>Tip:</strong> Select the <code>.html</code> file generated by mokuro. 
            Make sure the corresponding <code>.mokuro</code> file and <code>_ocr/</code> directory are in the same location.
          </div>
        </div>
      </div>
    </div>
  );
}
