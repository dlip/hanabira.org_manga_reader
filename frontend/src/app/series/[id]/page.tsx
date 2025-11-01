'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { ContentManager, type MangaSeries, type Chapter, type Bookmark, type ReadingSession, type SeriesStats, type ProgressRecord } from '@/lib/content';
import FileBrowser from '@/components/FileBrowser';
import ChapterUpload from '@/components/ChapterUpload';

interface AddChapterModalProps {
  isOpen: boolean;
  onClose: () => void;
  seriesId: string;
  onChapterAdded: () => void;
}

function AddChapterModal({ isOpen, onClose, seriesId, onChapterAdded }: AddChapterModalProps) {
  const [chapterNumber, setChapterNumber] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [filePath, setFilePath] = useState('');
  const [pageCount, setPageCount] = useState<number | ''>('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLoading, setIsLoading] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFileSelect = (selectedPath: string) => {
    setFilePath(selectedPath);
    
    // Auto-fill title from filename if title is empty
    if (!title.trim()) {
      const fileName = selectedPath.split('/').pop()?.replace('.html', '') || '';
      setTitle(fileName);
    }
  };

  const handleUploadComplete = (result: { success: boolean; chapterId?: string; error?: string }) => {
    if (result.success) {
      setMessage({ 
        type: 'success', 
        text: `Chapter uploaded successfully!` 
      });
      
      // Refresh the chapter list
      onChapterAdded();
      
      // Close modal after short delay
      setTimeout(() => {
        onClose();
        setMessage(null);
      }, 1500);
    } else {
      setMessage({ 
        type: 'error', 
        text: result.error || 'Upload failed' 
      });
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterNumber || !filePath.trim()) return;

    setIsLoading(true);
    try {
      // Import the selected Mokuro HTML and related assets into public folder
      // so that the viewer can access it via a web path and avoid 404s.
      // If the API fails, we gracefully fall back to the original path.
      let webFilePath = filePath.trim();
      fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceHtmlPath: webFilePath, seriesId }),
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            if (data.webPath) {
              webFilePath = data.webPath as string;
            }
          }
        })
        .finally(() => {
          ContentManager.addChapter({
            seriesId,
            chapterNumber: Number(chapterNumber),
            title: title.trim() || undefined,
            filePath: webFilePath,
            pageCount: pageCount ? Number(pageCount) : undefined,
          });

          // Reset form
          setChapterNumber('');
          setTitle('');
          setFilePath('');
          setPageCount('');
          setShowFileBrowser(false);
          
          onChapterAdded();
          onClose();
        });
    } catch (error) {
      console.error('Error adding chapter:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Add New Chapter</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Success/Error Messages */}
          {message && (
            <div className={`mb-4 p-3 rounded-md ${
              message.type === 'success' 
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {message.type === 'success' ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{message.text}</p>
                </div>
              </div>
            </div>
          )}

          {/* Upload Method Tabs */}
          {/* <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => setUploadMethod('drag-drop')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                uploadMethod === 'drag-drop'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Drag & Drop Upload
            </button>
            <button
              type="button"
              onClick={() => setUploadMethod('file-browser')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                uploadMethod === 'file-browser'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              File Browser (Legacy)
            </button>
          </div> */}

          {/* Drag & Drop Upload */}
          <ChapterUpload
            seriesId={seriesId}
            onUploadComplete={handleUploadComplete}
          />

          {/* Legacy File Browser Upload - Commented out, using drag-drop only 
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chapter Number *
                </label>
                <input
                  type="number"
                  value={chapterNumber}
                  onChange={(e) => setChapterNumber(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="1"
                  min="1"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Page Count
                </label>
                <input
                  type="number"
                  value={pageCount}
                  onChange={(e) => setPageCount(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="20"
                  min="1"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chapter Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                placeholder="Chapter title (optional)..."
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                File Path *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  className="flex-1 p-3 border-2 border-gray-300 rounded-lg text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="path/to/chapter.html"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowFileBrowser(true)}
                  disabled={isLoading}
                  className="px-4 py-3 bg-gray-100 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Browse for mokuro HTML file"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Path to the mokuro HTML file for this chapter. Use the browse button to navigate your file system.
              </p>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-green-200 text-green-800 rounded-lg hover:bg-green-300 shadow-sm transition-colors disabled:opacity-50"
                disabled={isLoading || !chapterNumber || !filePath.trim()}
              >
                {isLoading ? 'Adding...' : 'Add Chapter'}
              </button>
            </div>
          </form>
          */ }

        </div>
      </div>

      <FileBrowser
        isOpen={showFileBrowser}
        onFileSelect={handleFileSelect}
        onClose={() => setShowFileBrowser(false)}
      />
    </div>
  );
}

interface EditSeriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  series: MangaSeries;
  onSeriesUpdated: () => void;
}

function EditSeriesModal({ isOpen, onClose, series, onSeriesUpdated }: EditSeriesModalProps) {
  const [title, setTitle] = useState(series.title);
  const [author, setAuthor] = useState(series.author || '');
  const [description, setDescription] = useState(series.description || '');
  const [status, setStatus] = useState<'reading' | 'completed' | 'hiatus' | 'dropped' | 'ongoing'>(series.status);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Update form when series changes
  React.useEffect(() => {
    if (isOpen) {
      setTitle(series.title);
      setAuthor(series.author || '');
      setDescription(series.description || '');
      setStatus(series.status);
      setMessage(null);
    }
  }, [isOpen, series]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setMessage({ type: 'error', text: 'Title is required' });
      return;
    }

    setIsLoading(true);
    try {
      const success = await ContentManager.updateSeries(series.id, {
        title: title.trim(),
        author: author.trim() || undefined,
        description: description.trim() || undefined,
        status,
      });

      if (success) {
        setMessage({ type: 'success', text: 'Series updated successfully!' });
        onSeriesUpdated();
        
        // Close modal after short delay
        setTimeout(() => {
          onClose();
          setMessage(null);
        }, 1500);
      } else {
        setMessage({ type: 'error', text: 'Failed to update series' });
      }
    } catch (error) {
      console.error('Error updating series:', error);
      setMessage({ type: 'error', text: 'An error occurred while updating' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Edit Series</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Success/Error Messages */}
          {message && (
            <div className={`mb-4 p-3 rounded-md ${
              message.type === 'success' 
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {message.type === 'success' ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{message.text}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                id="edit-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Series title"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="edit-author" className="block text-sm font-medium text-gray-700 mb-2">
                Author
              </label>
              <input
                id="edit-author"
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Author name (optional)"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="edit-status" className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                id="edit-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'reading' | 'completed' | 'hiatus' | 'dropped' | 'ongoing')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              >
                <option value="ongoing">Ongoing</option>
                <option value="reading">Reading</option>
                <option value="completed">Completed</option>
                <option value="hiatus">Hiatus</option>
                <option value="dropped">Dropped</option>
              </select>
            </div>

            <div>
              <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Series description (optional)"
                disabled={isLoading}
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-purple-200 text-purple-800 rounded-lg hover:bg-purple-300 shadow-sm transition-colors disabled:opacity-50"
                disabled={isLoading || !title.trim()}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SeriesPage() {
  const params = useParams();
  const seriesId = params.id as string;
  
  // Types now imported from lib/content

  const [series, setSeries] = useState<MangaSeries | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [stats, setStats] = useState<SeriesStats | null>(null);
  const [readingSessions, setReadingSessions] = useState<ReadingSession[]>([]);
  const [chapterProgress, setChapterProgress] = useState<ProgressRecord>({});
  const [isAddChapterModalOpen, setIsAddChapterModalOpen] = useState(false);
  const [isEditSeriesModalOpen, setIsEditSeriesModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chapters' | 'bookmarks' | 'stats'>('chapters');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSeriesData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [seriesData, chaptersData, bookmarksData, statsData, sessionsData] = await Promise.all([
        ContentManager.getSeriesById(seriesId),
        ContentManager.getChapters(seriesId),
        ContentManager.getBookmarks(seriesId),
        ContentManager.getSeriesStats(seriesId),
        ContentManager.getReadingSessions(seriesId)
      ]);

      // Build per-chapter progress map
      const progressData: ProgressRecord = {};
      for (const chapter of chaptersData) {
        try {
          progressData[chapter.id] = await ContentManager.getChapterProgress(chapter.id);
        } catch (error) {
          console.error(`Error loading progress for chapter ${chapter.id}:`, error);
          progressData[chapter.id] = null;
        }
      }

      setSeries(seriesData);
      setChapters(chaptersData);
      setBookmarks(bookmarksData);
      setStats(statsData);
      setReadingSessions(sessionsData);
      setChapterProgress(progressData);
    } catch (error) {
      console.error('Error loading series data:', error);
      setError('Failed to load series data. Please try again.');
      setSeries(null);
      setChapters([]);
      setBookmarks([]);
      setStats(null);
      setReadingSessions([]);
      setChapterProgress({});
    } finally {
      setIsLoading(false);
    }
  }, [seriesId]);

  useEffect(() => {
    if (seriesId) {
      loadSeriesData();
    }
  }, [seriesId, loadSeriesData]);



  const deleteChapter = (chapterId: string, chapterNumber: number) => {
    if (confirm(`Are you sure you want to delete Chapter ${chapterNumber}? This will also remove all associated progress, bookmarks, and reading sessions.`)) {
      ContentManager.deleteChapter(chapterId);
      loadSeriesData();
    }
  };

  const deleteBookmark = (bookmarkId: string) => {
    if (confirm('Are you sure you want to delete this bookmark?')) {
      ContentManager.deleteBookmark(bookmarkId);
      loadSeriesData();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600 animate-pulse">Loading series...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <Link
            href="/library"
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back to Library
          </Link>
        </div>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 mb-4">Series not found</div>
          <Link
            href="/library"
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back to Library
          </Link>
        </div>
      </div>
    );
  }

  // (Stats & sessions now loaded within loadSeriesData)

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <Link
              href="/library"
              className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Library
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex gap-6 flex-1">
                  {/* Series Cover Image */}
                  {series.coverImage && (
                    <div className="flex-shrink-0">
                      <Image 
                        src={series.coverImage} 
                        alt={`${series.title} cover`}
                        width={128}
                        height={192}
                        className="w-32 h-48 object-cover rounded-lg shadow-md"
                        unoptimized
                      />
                    </div>
                  )}
                  
                  {/* Series Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl font-bold text-gray-900">{series.title}</h1>
                      <button
                        onClick={() => setIsEditSeriesModalOpen(true)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit series information"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                    {series.author && (
                      <p className="text-lg text-gray-600 mb-3">by {series.author}</p>
                    )}
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className={`px-3 py-1 text-sm rounded-full ${
                      series.status === 'ongoing' ? 'bg-green-100 text-green-800' :
                      series.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {series.status.charAt(0).toUpperCase() + series.status.slice(1)}
                    </span>
                    
                    {series.genre && Array.isArray(series.genre) && series.genre.map(g => (
                      <span key={g} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full">
                        {g}
                      </span>
                    ))}
                  </div>

                  {series.description && (
                    <p className="text-gray-700 mb-4">{series.description}</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-600">{chapters.length}</div>
                      <div className="text-sm text-gray-600">Chapters</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-green-600">{stats ? Math.round(stats.completionPercentage) : 0}%</div>
                      <div className="text-sm text-gray-600">Complete</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-purple-600">{bookmarks.length}</div>
                      <div className="text-sm text-gray-600">Bookmarks</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-orange-600">{stats ? stats.totalSessions : 0}</div>
                      <div className="text-sm text-gray-600">Sessions</div>
                    </div>
                  </div>
                  </div>
                </div>

                <div className="ml-6">
                  <button
                    onClick={() => setIsAddChapterModalOpen(true)}
                    className="px-4 py-2 bg-green-200 text-green-800 rounded-lg hover:bg-green-300 shadow-sm transition-colors flex items-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Chapter
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex space-x-8 px-6">
              {['chapters', 'bookmarks', 'stats'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as 'chapters' | 'bookmarks' | 'stats')}
                  className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === 'chapters' && ` (${chapters.length})`}
                  {tab === 'bookmarks' && ` (${bookmarks.length})`}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* Chapters Tab */}
            {activeTab === 'chapters' && (
              <div>
                {chapters.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-500 mb-4">
                      <svg className="mx-auto h-16 w-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      No chapters added yet
                    </div>
                    <p className="text-gray-600 mb-6">
                      Add chapters to start reading and tracking your progress
                    </p>
                    <button
                      onClick={() => setIsAddChapterModalOpen(true)}
                      className="bg-green-200 text-green-800 px-6 py-3 rounded-lg hover:bg-green-300 shadow-sm transition-colors"
                    >
                      Add First Chapter
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chapters.map((chapter) => {
                      const progress = chapterProgress[chapter.id];
                      const isCompleted = progress?.isCompleted || false;
                      const progressPercent = progress?.percentage || 0;

                      return (
                        <div
                          key={chapter.id}
                          className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-2">
                                  <span className="font-semibold text-gray-900">
                                    Chapter {chapter.chapterNumber}
                                  </span>
                                  {isCompleted && (
                                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                                {chapter.title && (
                                  <span className="text-gray-700">{chapter.title}</span>
                                )}
                              </div>
                              
                              <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                                {chapter.pageCount && (
                                  <span>{chapter.pageCount} pages</span>
                                )}
                                <span>Added {new Date(chapter.addedDate).toLocaleDateString()}</span>
                                {progress && (
                                  <span>{Math.round(progressPercent)}% read</span>
                                )}
                              </div>

                              {progress && !isCompleted && (
                                <div className="mt-2">
                                  <progress
                                    value={progressPercent}
                                    max={100}
                                    aria-label="Chapter progress"
                                    className="w-full h-2 rounded-full overflow-hidden align-middle 
                                    [&::-webkit-progress-bar]:bg-gray-200 
                                    [&::-webkit-progress-value]:bg-blue-500 
                                    [&::-moz-progress-bar]:bg-blue-500"
                                  />
                                </div>
                              )}
                            </div>

                            <div className="flex items-center space-x-2 ml-4">
                              <Link
                                href={`/?chapter=${chapter.id}`}
                                className="px-4 py-2 bg-blue-200 text-blue-800 rounded-lg hover:bg-blue-300 shadow-sm transition-colors text-sm"
                              >
                                {progress && progressPercent > 0 ? 'Continue' : 'Start Reading'}
                              </Link>
                              
                              <button
                                onClick={() => deleteChapter(chapter.id, chapter.chapterNumber)}
                                className="p-2 bg-red-200 text-red-800 rounded-lg hover:bg-red-300 shadow-sm transition-colors"
                                title="Delete chapter"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Bookmarks Tab */}
            {activeTab === 'bookmarks' && (
              <div>
                {bookmarks.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-500 mb-4">
                      <svg className="mx-auto h-16 w-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      No bookmarks yet
                    </div>
                    <p className="text-gray-600">
                      Bookmarks will appear here as you save interesting pages while reading
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {bookmarks.map((bookmark) => {
                      const chapter = chapters.find(c => c.id === bookmark.chapterId);
                      
                      return (
                        <div
                          key={bookmark.id}
                          className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">

                              <p className="text-sm text-gray-600">
                                Chapter {chapter?.chapterNumber} • Page {bookmark.pageNumber}
                              </p>
                              {bookmark.note && (
                                <p className="text-sm text-gray-700 mt-2">{bookmark.note}</p>
                              )}
                              <p className="text-xs text-gray-500 mt-2">
                                {new Date(bookmark.timestamp).toLocaleString()}
                              </p>
                            </div>
                            
                            <button
                              onClick={() => deleteBookmark(bookmark.id)}
                              className="ml-2 p-1 bg-red-200 text-red-800 rounded-lg hover:bg-red-300 shadow-sm transition-colors"
                              title="Delete bookmark"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          
                          <Link
                            href={`/?chapter=${bookmark.chapterId}&page=${bookmark.pageNumber}`}
                            className="block w-full text-center px-3 py-2 bg-blue-200 text-blue-800 rounded-lg hover:bg-blue-300 shadow-sm transition-colors text-sm"
                          >
                            Go to Page
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-blue-200 rounded-lg p-6 shadow-sm">
                    <div className="text-3xl font-bold mb-2 text-blue-800">{stats ? Math.round(stats.totalReadingTime / 60000) : 0}m</div>
                    <div className="text-blue-700">Total Reading Time</div>
                  </div>
                  
                  <div className="bg-green-200 rounded-lg p-6 shadow-sm">
                    <div className="text-3xl font-bold mb-2 text-green-800">{stats ? stats.totalPagesRead : 0}</div>
                    <div className="text-green-700">Pages Read</div>
                  </div>
                  
                  <div className="bg-purple-200 rounded-lg p-6 shadow-sm">
                    <div className="text-3xl font-bold mb-2 text-purple-800">{stats ? Math.round(stats.averageSessionTime / 60000) : 0}m</div>
                    <div className="text-purple-700">Avg Session</div>
                  </div>
                  
                  <div className="bg-orange-200 rounded-lg p-6 shadow-sm">
                    <div className="text-3xl font-bold mb-2 text-orange-800">{stats ? Math.round(stats.completionPercentage) : 0}%</div>
                    <div className="text-orange-700">Completion</div>
                  </div>
                </div>

                {/* Recent Sessions */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Reading Sessions</h3>
                  {readingSessions.slice(0, 10).map((session) => {
                    const chapter = chapters.find(c => c.id === session.chapterId);
                    const duration = session.endTime ? session.endTime - session.startTime : 0;
                    
                    return (
                      <div key={session.id} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                        <div>
                          <span className="font-medium text-gray-900">
                            Chapter {chapter?.chapterNumber}
                          </span>
                          <span className="text-gray-600 ml-2">
                            {session.pagesRead} pages • {Math.round(duration / 60000)}m
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(session.startTime).toLocaleDateString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add Chapter Modal */}
        <AddChapterModal
          isOpen={isAddChapterModalOpen}
          onClose={() => setIsAddChapterModalOpen(false)}
          seriesId={seriesId}
          onChapterAdded={loadSeriesData}
        />

        {/* Edit Series Modal */}
        {series && (
          <EditSeriesModal
            isOpen={isEditSeriesModalOpen}
            onClose={() => setIsEditSeriesModalOpen(false)}
            series={series}
            onSeriesUpdated={loadSeriesData}
          />
        )}
      </div>
    </div>
  );
}
