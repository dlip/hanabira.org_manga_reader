'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ChangeCoverModal from '@/components/ChangeCoverModal';
import { ContentManager, type MangaSeries, type ReadingProgress, type Chapter } from '@/lib/content';

interface AddSeriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSeriesAdded: () => void;
}

function AddSeriesModal({ isOpen, onClose, onSeriesAdded }: AddSeriesModalProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [status, setStatus] = useState<'ongoing' | 'completed' | 'hiatus'>('ongoing');
  const [totalChapters, setTotalChapters] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(false);

  // Cover image state and helpers
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onPaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items || []);
      const imageItem = items.find((it) => it.type.startsWith('image/'));
      if (!imageItem) return;
      const blob = imageItem.getAsFile();
      if (!blob) return;
      await handleBlobAsCover(blob);
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const resetForm = () => {
    setTitle('');
    setAuthor('');
    setDescription('');
    setGenre('');
    setStatus('ongoing');
    setTotalChapters('');
    setCoverImage(null);
    setImageError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsLoading(true);
    try {
      // Note: Backend API does not yet persist genre; we store it as a comma-separated string
      await ContentManager.addSeries({
        title: title.trim(),
        author: author.trim() || undefined,
        description: description.trim() || undefined,
        genre: genre.trim() || undefined,
        status,
        totalChapters: totalChapters ? Number(totalChapters) : undefined,
        coverImage: coverImage || undefined,
      });

      // Reset form
      resetForm();
      onSeriesAdded();
      onClose();
    } catch (error) {
      console.error('Error adding series:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateAndReadImage = (file: File) => {
    setImageError(null);
    if (!file.type.startsWith('image/')) {
      setImageError('Unsupported file type. Please select an image.');
      return;
    }
    // Soft size limit ~2MB to avoid bloating localStorage
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      setImageError('Image is too large. Please choose an image under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCoverImage(result);
    };
    reader.onerror = () => setImageError('Failed to read the image.');
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndReadImage(file);
    // Reset value so selecting the same file again will trigger onChange
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndReadImage(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleBlobAsCover = async (blob: Blob) => {
    const fileLike = new File([blob], 'pasted-image', { type: blob.type || 'image/png' });
    validateAndReadImage(fileLike);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-800/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Add New Series</h2>
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-800 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                placeholder="Enter manga title..."
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">
                Author
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                placeholder="Author name..."
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-lg resize-none text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                rows={3}
                placeholder="Brief description..."
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'ongoing' | 'completed' | 'hiatus')}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  title="Select status"
                  disabled={isLoading}
                >
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="hiatus">Hiatus</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  Total Chapters
                </label>
                <input
                  type="number"
                  value={totalChapters}
                  onChange={(e) => setTotalChapters(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="Number of chapters"
                  min="1"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">
                Genre (comma-separated)
              </label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                placeholder="Action, Comedy, Romance..."
                disabled={isLoading}
              />
            </div>

            {/* Cover Image Uploader */}
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">
                Cover Image (optional)
              </label>
              <div
                ref={dropRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                  coverImage ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-blue-400'
                }`}
              >
                {coverImage ? (
                  <div className="space-y-2">
                    <div className="w-full max-w-xs mx-auto aspect-[2/3] overflow-hidden rounded-md bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverImage} alt="Cover preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        disabled={isLoading}
                      >
                        Replace Image
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoverImage(null)}
                        className="px-3 py-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-md hover:bg-red-100"
                        disabled={isLoading}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-600">
                    <p className="mb-2">Drop an image here, click to upload, or paste from clipboard (Ctrl/⌘+V).</p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        disabled={isLoading}
                      >
                        Choose File
                      </button>
                      <span className="text-xs text-gray-500">PNG, JPG, or WebP • Max 2MB</span>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  aria-label="Upload cover image"
                  title="Upload cover image"
                  placeholder=""
                  disabled={isLoading}
                />
              </div>
              {imageError && (
                <p className="mt-2 text-sm text-red-600">{imageError}</p>
              )}
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
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                disabled={isLoading || !title.trim()}
              >
                {isLoading ? 'Adding...' : 'Add Series'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const [series, setSeries] = useState<MangaSeries[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [sortBy, setSortBy] = useState<'title' | 'lastRead' | 'added'>('lastRead');
  const [coverModalSeriesId, setCoverModalSeriesId] = useState<string | null>(null);
  const [coverModalSeries, setCoverModalSeries] = useState<MangaSeries | null>(null);
  const [orphanCount, setOrphanCount] = useState<number | null>(null);
  const [brokenRefsCount, setBrokenRefsCount] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid-large' | 'grid-medium' | 'grid-small' | 'list'>('grid-medium');

  // Load view mode preference from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('library-view-mode') as 'grid-large' | 'grid-medium' | 'grid-small' | 'list' | null;
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view mode preference to localStorage
  const handleViewModeChange = (mode: 'grid-large' | 'grid-medium' | 'grid-small' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('library-view-mode', mode);
  };

  useEffect(() => {
    loadSeries();
    // Lightweight orphan count fetch (HEAD not implemented so we fetch and discard heavy fields after mapping)
    (async () => {
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000') + '/maintenance/orphans');
        if (res.ok) {
          const data = await res.json();
            if (data && Array.isArray(data.orphans)) {
              setOrphanCount(data.orphans.length);
            }
        }
  } catch {
        // ignore silently; badge just won't show
      }
    })();
    // Fetch broken references count
    (async () => {
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000') + '/maintenance/broken-references');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.broken_references)) {
            setBrokenRefsCount(data.broken_references.length);
          }
        }
      } catch {
        // ignore silently; badge just won't show
      }
    })();
  }, []);

  const loadSeries = async () => {
    try {
      const allSeries = await ContentManager.getSeries();
      setSeries(allSeries);
    } catch (error) {
      console.error('Error loading series:', error);
      setSeries([]); // Fallback to empty array
    }
  };

  const deleteSeries = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}" and all its data?`)) {
      try {
        await ContentManager.deleteSeries(id);
        await loadSeries();
      } catch (error) {
        console.error('Error deleting series:', error);
        alert('Failed to delete series. Please try again.');
      }
    }
  };

  const openCoverModal = async (seriesId: string) => {
    try {
      const seriesData = await ContentManager.getSeriesById(seriesId);
      setCoverModalSeries(seriesData);
      setCoverModalSeriesId(seriesId);
    } catch (error) {
      console.error('Error loading series for cover modal:', error);
    }
  };

  const closeCoverModal = () => {
    setCoverModalSeriesId(null);
    setCoverModalSeries(null);
  };

  const getFilteredSeries = () => {
    let filtered = [...series];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.author && s.author.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status filter
    if (filterStatus) {
      filtered = filtered.filter(s => s.status === filterStatus);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'lastRead':
          return (b.lastReadDate || 0) - (a.lastReadDate || 0);
        case 'added':
          return b.addedDate - a.addedDate;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const [seriesProgress, setSeriesProgress] = useState<Record<string, { completed: number; total: number; percentage: number }>>({});

  useEffect(() => {
    const loadProgress = async () => {
      const progressMap: Record<string, { completed: number; total: number; percentage: number }> = {};
      for (const s of series) {
        try {
          const chapters: Chapter[] = await ContentManager.getChapters(s.id);
          const progressEntries: ReadingProgress[] = await ContentManager.getProgress(s.id);
          if (chapters.length === 0) {
            progressMap[s.id] = { completed: 0, total: 0, percentage: 0 };
            continue;
          }
            
          const completed = progressEntries.filter((p: ReadingProgress) => p.isCompleted).length;
          const percentage = (completed / chapters.length) * 100;
          progressMap[s.id] = { completed, total: chapters.length, percentage };
        } catch (error) {
          console.error('Error loading progress for series', s.id, error);
          progressMap[s.id] = { completed: 0, total: 0, percentage: 0 };
        }
      }
      setSeriesProgress(progressMap);
    };
    if (series.length > 0) {
      loadProgress();
    }
  }, [series]);

  const filteredSeries = getFilteredSeries();

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Reader
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <svg className="w-8 h-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.168 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Manga Library
            </h1>
            {orphanCount !== null && orphanCount > 0 && (
              <Link href="/library/orphans" className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200">
                <span>Orphans</span>
                <span className="inline-block min-w-[1.25rem] text-center bg-red-600 text-white rounded px-1">{orphanCount}</span>
              </Link>
            )}
            {brokenRefsCount !== null && brokenRefsCount > 0 && (
              <Link href="/library/broken-references" className="inline-flex items-center gap-1 px-2 py-1 rounded bg-orange-100 text-orange-700 text-xs font-semibold hover:bg-orange-200">
                <span>Broken Refs</span>
                <span className="inline-block min-w-[1.25rem] text-center bg-orange-600 text-white rounded px-1">{brokenRefsCount}</span>
              </Link>
            )}
            <span className="text-lg text-gray-600">
              ({series.length} series)
            </span>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-6 py-3 bg-green-200 text-green-800 rounded-lg hover:bg-green-300 transition-colors flex items-center shadow-sm"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Series
          </button>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[300px]">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search series by title or author..."
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              />
            </div>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="p-3 border-2 border-gray-300 rounded-lg text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              title="Filter by status"
            >
              <option value="">All Status</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="hiatus">Hiatus</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'title' | 'lastRead' | 'added')}
              className="p-3 border-2 border-gray-300 rounded-lg text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              title="Sort series"
            >
              <option value="lastRead">Last Read</option>
              <option value="title">Title (A-Z)</option>
              <option value="added">Recently Added</option>
            </select>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 border-2 border-gray-300 rounded-lg p-1">
              <button
                onClick={() => handleViewModeChange('grid-large')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid-large' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Large grid view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => handleViewModeChange('grid-medium')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid-medium' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Medium grid view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => handleViewModeChange('grid-small')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid-small' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Small grid view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => handleViewModeChange('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="List view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Series Grid */}
        {filteredSeries.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-700 mb-4">
              <svg className="mx-auto h-24 w-24 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.168 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {series.length === 0 ? 'No manga series yet' : 'No series match your filters'}
            </div>
            <p className="text-lg text-gray-600 mb-6">
              {series.length === 0 
                ? 'Add your first manga series to start building your library!'
                : 'Try adjusting your search or filters.'
              }
            </p>
            {series.length === 0 && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-green-200 text-green-800 px-6 py-3 rounded-lg hover:bg-green-300 transition-colors shadow-sm"
              >
                Add Your First Series
              </button>
            )}
          </div>
        ) : (
          <div className={
            viewMode === 'grid-large' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' :
            viewMode === 'grid-medium' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' :
            viewMode === 'grid-small' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4' :
            'space-y-4' // list view
          }>
              {filteredSeries.map((seriesItem: MangaSeries) => {
              const progress = seriesProgress[seriesItem.id] || { completed: 0, total: 0, percentage: 0 };
              
              // List View
              if (viewMode === 'list') {
                return (
                  <div
                    key={seriesItem.id}
                    className="bg-white rounded-lg shadow hover:shadow-lg transition-all duration-300 p-4"
                  >
                    <div className="flex gap-4 items-center">
                      {/* Cover Thumbnail */}
                      <Link href={`/series/${seriesItem.id}`} className="flex-shrink-0">
                        {seriesItem.coverImage ? (
                          <div className="w-16 h-24 bg-gray-100 rounded overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={seriesItem.coverImage} alt={`${seriesItem.title} cover`} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-16 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
                            <svg className="w-8 h-8 text-white opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.168 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                          </div>
                        )}
                      </Link>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <Link href={`/series/${seriesItem.id}`}>
                              <h3 className="font-bold text-lg text-gray-900 hover:text-blue-600 transition-colors">
                                {seriesItem.title}
                              </h3>
                            </Link>
                            {seriesItem.author && (
                              <p className="text-sm text-gray-600">by {seriesItem.author}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${
                              seriesItem.status === 'ongoing' ? 'bg-green-100 text-green-800' :
                              seriesItem.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {seriesItem.status.charAt(0).toUpperCase() + seriesItem.status.slice(1)}
                            </span>
                          </div>
                        </div>

                        {/* Progress */}
                        {progress.total > 0 && (
                          <div className="mt-2 flex items-center gap-4">
                            <div className="flex-1">
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>{progress.completed}/{progress.total} chapters</span>
                                <span>{Math.round(progress.percentage)}%</span>
                              </div>
                              <progress className="w-full h-2" value={Math.round(progress.percentage)} max={100} />
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="mt-3 flex gap-2">
                          <Link
                            href={`/series/${seriesItem.id}`}
                            className="px-4 py-1.5 bg-blue-200 text-blue-800 rounded-lg hover:bg-blue-300 transition-colors text-sm shadow-sm"
                          >
                            View Details
                          </Link>
                          <button
                            onClick={() => openCoverModal(seriesItem.id)}
                            className="px-3 py-1.5 bg-purple-200 text-purple-800 rounded-lg hover:bg-purple-300 transition-colors shadow-sm"
                            title="Change cover image"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteSeries(seriesItem.id, seriesItem.title)}
                            className="px-3 py-1.5 bg-red-200 text-red-800 rounded-lg hover:bg-red-300 transition-colors shadow-sm"
                            title="Delete series"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Grid Views (small, medium, large)
              const isSmallGrid = viewMode === 'grid-small';
              
              return (
                <div
                  key={seriesItem.id}
                  className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 group"
                >
                  {/* Cover Image */}
                  <Link href={`/series/${seriesItem.id}`}>
                    {seriesItem.coverImage ? (
                      <div className="aspect-[2/3] bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={seriesItem.coverImage} alt={`${seriesItem.title} cover`} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-[2/3] bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <div className="text-white text-center p-4">
                          <svg className={`${isSmallGrid ? 'w-8 h-8' : 'w-16 h-16'} mx-auto mb-2 opacity-80`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.168 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          {!isSmallGrid && <h3 className="font-bold text-lg line-clamp-2">{seriesItem.title}</h3>}
                        </div>
                      </div>
                    )}
                  </Link>

                  <div className={isSmallGrid ? 'p-2' : 'p-4'}>
                    {!isSmallGrid && (
                      <div className="mb-3">
                        <h3 className="font-bold text-lg text-gray-900 mb-1 line-clamp-1">
                          {seriesItem.title}
                        </h3>
                        {seriesItem.author && (
                          <p className="text-sm text-gray-600 mb-2">by {seriesItem.author}</p>
                        )}
                        
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            seriesItem.status === 'ongoing' ? 'bg-green-100 text-green-800' :
                            seriesItem.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {seriesItem.status.charAt(0).toUpperCase() + seriesItem.status.slice(1)}
                          </span>
                          
                          {progress.total > 0 && (
                            <span className="text-xs text-gray-600">
                              {progress.completed}/{progress.total} chapters
                            </span>
                          )}
                        </div>

                        {/* Progress Bar */}
                        {progress.total > 0 && (
                          <div className="mb-3">
                            <div className="flex justify-between text-xs text-gray-600 mb-1" aria-label="Progress">
                              <span>Progress</span>
                              <span>{Math.round(progress.percentage)}%</span>
                            </div>
                            <progress className="w-full h-2" value={Math.round(progress.percentage)} max={100} aria-label="Series progress" />
                          </div>
                        )}

                        {/* Genre Tags */}
                        {(() => {
                          const genreTags = seriesItem.genre
                            ? seriesItem.genre.split(',').map(g => g.trim()).filter(Boolean)
                            : [];
                          if (genreTags.length === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {genreTags.slice(0, 3).map((g: string) => (
                                <span key={g} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                                  {g}
                                </span>
                              ))}
                              {genreTags.length > 3 && (
                                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                                  +{genreTags.length - 3}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Small Grid Compact View */}
                    {isSmallGrid && (
                      <div className="mb-2">
                        <h3 className="font-bold text-xs text-gray-900 mb-1 line-clamp-2">
                          {seriesItem.title}
                        </h3>
                        {progress.total > 0 && (
                          <div className="mb-1">
                            <progress className="w-full h-1" value={Math.round(progress.percentage)} max={100} aria-label="Series progress" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    {!isSmallGrid ? (
                      <div className="flex space-x-2">
                        <Link
                          href={`/series/${seriesItem.id}`}
                          className="flex-1 text-center px-3 py-2 bg-blue-200 text-blue-800 rounded-lg hover:bg-blue-300 transition-colors text-sm shadow-sm"
                        >
                          View Details
                        </Link>
                        <button
                          onClick={() => openCoverModal(seriesItem.id)}
                          className="px-3 py-2 bg-purple-200 text-purple-800 rounded-lg hover:bg-purple-300 transition-colors shadow-sm"
                          title="Change cover image"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </button>
                        
                        <button
                          onClick={() => deleteSeries(seriesItem.id, seriesItem.title)}
                          className="px-3 py-2 bg-red-200 text-red-800 rounded-lg hover:bg-red-300 transition-colors shadow-sm"
                          title="Delete series"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-center gap-1">
                        <Link
                          href={`/series/${seriesItem.id}`}
                          className="flex-1 text-center px-2 py-1 bg-blue-200 text-blue-800 rounded hover:bg-blue-300 transition-colors text-xs shadow-sm"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => deleteSeries(seriesItem.id, seriesItem.title)}
                          className="px-2 py-1 bg-red-200 text-red-800 rounded hover:bg-red-300 transition-colors shadow-sm"
                          title="Delete series"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Quick Stats - Only show in non-small grid */}
                    {!isSmallGrid && seriesItem.lastReadDate && (
                      <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
                        Last read: {new Date(seriesItem.lastReadDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Series Modal */}
        <AddSeriesModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSeriesAdded={loadSeries}
        />

        {/* Change Cover Modal */}
        {coverModalSeriesId && coverModalSeries && (
          <ChangeCoverModal
            isOpen={!!coverModalSeriesId}
            onClose={closeCoverModal}
            seriesId={coverModalSeriesId}
            initialImage={coverModalSeries.coverImage || undefined}
            onSaved={loadSeries}
          />
        )}
      </div>
    </div>
  );
}
