'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ContentManager, type Bookmark, type MangaSeries, type Chapter } from '@/lib/content';

interface BookmarksPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentChapterId?: string;
  currentPage?: number;
  onBookmarkClick: (bookmark: Bookmark) => void;
}

interface AddBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  seriesId: string;
  chapterId: string;
  pageNumber: number;
  onBookmarkAdded: () => void;
}

interface BookmarkItemProps {
  bookmark: Bookmark;
  onBookmarkClick: (bookmark: Bookmark) => void;
  onDelete: (bookmarkId: string) => void;
}

function BookmarkItem({ bookmark, onBookmarkClick, onDelete }: BookmarkItemProps) {
  const [series, setSeries] = useState<MangaSeries | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const [seriesData, chapterData] = await Promise.all([
          ContentManager.getSeriesById(bookmark.seriesId),
          ContentManager.getChapterById(bookmark.chapterId)
        ]);
        if (!cancelled) {
          setSeries(seriesData);
          setChapter(chapterData);
        }
      } catch (error) {
        console.error('Error loading bookmark related data:', error);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [bookmark.seriesId, bookmark.chapterId]);

  return (
    <div
      className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors cursor-pointer"
      onClick={() => onBookmarkClick(bookmark)}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
              Page {bookmark.pageNumber}
            </span>
            {chapter && (
              <span className="text-xs text-gray-600">
                Ch. {chapter.chapterNumber}
              </span>
            )}
          </div>
          {series && (
            <div className="font-medium">{series.title}</div>
          )}
          {chapter?.title && (
            <div className="text-sm text-gray-600">{chapter.title}</div>  
          )}
          {bookmark.note && (
            <div className="text-sm text-gray-700 mt-1 italic">
              &ldquo;{bookmark.note}&rdquo;
            </div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            {new Date(bookmark.timestamp).toLocaleDateString()}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(bookmark.id);
          }}
          className="ml-2 text-red-500 hover:text-red-700 text-sm"
          title="Delete bookmark"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function AddBookmarkModal({ isOpen, onClose, seriesId, chapterId, pageNumber, onBookmarkAdded }: AddBookmarkModalProps) {
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsLoading(true);
    try {
      ContentManager.addBookmark({
        seriesId,
        chapterId,
        pageNumber,
        note: note.trim() || undefined,
      });

      setNote('');
      onBookmarkAdded();
      onClose();
    } catch (error) {
      console.error('Error adding bookmark:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-800/75 backdrop-blur-sm transition-all" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Add Bookmark</h2>
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-800 text-xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">
                Note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-lg resize-none text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                rows={3}
                placeholder="Add a note about this page..."
                disabled={isLoading}
              />
            </div>

            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              Bookmarking page {pageNumber}
            </div>

            <div className="flex space-x-3 pt-2">
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
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? 'Adding...' : 'Add Bookmark'}
              </button>
            </div>
          </form>
        </div>
        </div>
      </div>
    </>
  );
}

export default function BookmarksPanel({ isOpen, onClose, currentChapterId, currentPage, onBookmarkClick }: BookmarksPanelProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [seriesId, setSeriesId] = useState<string>('');

  const loadBookmarks = useCallback(async () => {
    try {
      const allBookmarks = await ContentManager.getBookmarks();
      setBookmarks(allBookmarks);

      if (currentChapterId) {
        const chapter = await ContentManager.getChapterById(currentChapterId);
        if (chapter) {
          setSeriesId(chapter.seriesId);
        }
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      setBookmarks([]);
    }
  }, [currentChapterId]);

  useEffect(() => {
    if (isOpen) {
      loadBookmarks();
    }
  }, [isOpen, loadBookmarks]);

  const deleteBookmark = (bookmarkId: string) => {
    if (confirm('Are you sure you want to delete this bookmark?')) {
      ContentManager.deleteBookmark(bookmarkId);
      loadBookmarks();
    }
  };

  const handleAddBookmark = () => {
    if (!currentChapterId || !currentPage || !seriesId) {
      alert('Cannot add bookmark: missing chapter or page information');
      return;
    }
    setShowAddModal(true);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-800/75 backdrop-blur-sm transition-all" onClick={onClose} />
      
      <div className="fixed right-4 top-4 bottom-4 w-80 bg-white rounded-lg shadow-xl z-50 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">📑 Bookmarks</h2>
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-800 text-xl"
            >
              ×
            </button>
          </div>
          
          {currentChapterId && currentPage && (
            <button
              onClick={handleAddBookmark}
              className="mt-3 w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center text-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Bookmark Current Page
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {bookmarks.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <p className="text-gray-500 text-sm">No bookmarks yet</p>
              <p className="text-gray-400 text-xs mt-1">
                Save interesting pages while reading
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookmarks.map((bookmark) => (
                <BookmarkItem
                  key={bookmark.id}
                  bookmark={bookmark}
                  onBookmarkClick={onBookmarkClick}
                  onDelete={deleteBookmark}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Bookmark Modal */}
      <AddBookmarkModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        seriesId={seriesId}
        chapterId={currentChapterId || ''}
        pageNumber={currentPage || 1}
        onBookmarkAdded={() => {
          loadBookmarks();
          setShowAddModal(false);
        }}
      />
    </>
  );
}
