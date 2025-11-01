"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';

interface BrokenChapter {
  chapter_id: string;
  chapter_number: number | null;
  file_path: string;
}

interface BrokenReference {
  series_id: string;
  series_title: string;
  broken_chapters: BrokenChapter[];
  all_files_missing: boolean;
}

interface BrokenReferenceWithUi extends BrokenReference {
  deleting?: boolean;
  error?: string;
}

export function BrokenReferencesClient() {
  const [brokenRefs, setBrokenRefs] = useState<BrokenReferenceWithUi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<BrokenReferenceWithUi | null>(null);
  const { addToast } = useToast();

  const loadBrokenReferences = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch('http://localhost:5000/maintenance/broken-references');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to load');
      setBrokenRefs(data.broken_references || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load broken references');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadBrokenReferences(); }, [loadBrokenReferences]);

  const handleDelete = async (seriesId: string) => {
    setBrokenRefs(prev => prev.map(r => r.series_id === seriesId ? { ...r, deleting: true, error: undefined } : r));
    try {
      const response = await fetch(`http://localhost:5000/maintenance/broken-references/${seriesId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP ${response.status}`);
      }
      const result = await response.json();
      addToast(`Deleted series from database: ${result.deleted_chapters_count} chapters removed`, 'success');
      await loadBrokenReferences();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
      addToast(`Failed to delete broken reference: ${msg}`, 'error');
      setBrokenRefs(prev => prev.map(r => r.series_id === seriesId ? { ...r, deleting: false, error: msg } : r));
    }
  };

  const openDelete = (ref: BrokenReferenceWithUi) => setConfirmTarget(ref);
  const confirmDeletion = () => { 
    if (!confirmTarget) return; 
    const target = confirmTarget; 
    setConfirmTarget(null); 
    handleDelete(target.series_id); 
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          <p className="mt-4 text-slate-600">Loading broken references...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link 
                href="/library" 
                className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors duration-200 group"
              >
                <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm font-medium">Library</span>
              </Link>
              <div className="h-4 w-px bg-slate-300" />
              <h1 className="text-2xl font-light text-slate-900 tracking-tight">Broken References</h1>
            </div>
            <button
              onClick={loadBrokenReferences}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-100 text-teal-700 hover:bg-teal-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
          <p className="text-sm text-slate-600 max-w-3xl">
            Database records pointing to missing files. These series/chapters exist in the database but their files are gone from the filesystem.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="text-sm font-medium text-slate-600 mb-1">Total Broken Series</div>
            <div className="text-3xl font-light text-slate-900">{brokenRefs.length}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="text-sm font-medium text-slate-600 mb-1">With All Files Missing</div>
            <div className="text-3xl font-light text-red-600">
              {brokenRefs.filter(r => r.all_files_missing).length}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="text-sm font-medium text-slate-600 mb-1">Total Broken Chapters</div>
            <div className="text-3xl font-light text-orange-600">
              {brokenRefs.reduce((acc, r) => acc + r.broken_chapters.length, 0)}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Empty State */}
        {!error && brokenRefs.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No Broken References</h3>
            <p className="text-slate-600">All database records point to existing files. Your library is healthy!</p>
          </div>
        )}

        {/* Broken References List */}
        {brokenRefs.length > 0 && (
          <div className="space-y-4">
            {brokenRefs.map(ref => (
              <div 
                key={ref.series_id} 
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium text-slate-900">{ref.series_title}</h3>
                      {ref.all_files_missing && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          All Files Missing
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 font-mono">{ref.series_id}</p>
                  </div>
                  <button
                    onClick={() => openDelete(ref)}
                    disabled={ref.deleting}
                    className="px-4 py-2 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {ref.deleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-rose-700"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete from DB
                      </>
                    )}
                  </button>
                </div>

                {ref.error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {ref.error}
                  </div>
                )}

                {/* Chapter List */}
                {ref.broken_chapters.length > 0 && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">
                      Missing Files ({ref.broken_chapters.length} chapters)
                    </h4>
                    <div className="space-y-2">
                      {ref.broken_chapters.slice(0, 5).map(chapter => (
                        <div key={chapter.chapter_id} className="flex items-center gap-3 text-sm">
                          <span className="px-2 py-1 bg-slate-100 rounded text-slate-700 font-medium min-w-[60px] text-center">
                            Ch {chapter.chapter_number ?? '?'}
                          </span>
                          <code className="flex-1 text-slate-600 bg-slate-50 px-3 py-1 rounded font-mono text-xs truncate">
                            {chapter.file_path}
                          </code>
                          <span className="text-red-600 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Missing
                          </span>
                        </div>
                      ))}
                      {ref.broken_chapters.length > 5 && (
                        <p className="text-sm text-slate-500 italic">
                          ... and {ref.broken_chapters.length - 5} more chapters
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Confirm Database Cleanup</h3>
            <p className="text-slate-600 mb-6">
              This will permanently delete <strong>{confirmTarget.series_title}</strong> and its{' '}
              <strong>{confirmTarget.broken_chapters.length} chapters</strong> from the database.
              <br/><br/>
              <span className="text-red-600 font-medium">This operation cannot be undone.</span>
              <br/>
              Files are already missing - this only cleans up database records.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmTarget(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletion}
                className="px-4 py-2 bg-rose-600 text-white hover:bg-rose-700 rounded-lg transition-colors"
              >
                Delete from Database
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
