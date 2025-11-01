"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';
import { apiClient } from '@/lib/api-client';
import type { OrphanChapterDir } from '@/lib/api-client';

interface OrphanWithUi extends OrphanChapterDir {
  deleting?: boolean;
  error?: string;
}

export function OrphanClient() {
  const [orphans, setOrphans] = useState<OrphanWithUi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<OrphanWithUi | null>(null);
  const { addToast } = useToast();

  const loadOrphans = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await apiClient.maintenance.listOrphanChapterDirs();
      data.sort((a, b) => b.size_bytes - a.size_bytes);
      setOrphans(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orphans');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadOrphans(); }, [loadOrphans]);

  const handleDelete = async (seriesId: string, chapterFolder: string) => {
    setOrphans(prev => prev.map(o => o.series_id === seriesId && o.chapter_folder === chapterFolder ? { ...o, deleting: true, error: undefined } : o));
    try {
      await apiClient.maintenance.deleteOrphanChapterDir(seriesId, chapterFolder);
      addToast(`Deleted ${chapterFolder ? 'chapter' : 'series'} orphan: /library/${seriesId}${chapterFolder ? '/' + chapterFolder : ''}`, 'success');
      await loadOrphans();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
      addToast(`Failed to delete orphan: ${msg}`, 'error');
      setOrphans(prev => prev.map(o => o.series_id === seriesId && o.chapter_folder === chapterFolder ? { ...o, deleting: false, error: msg } : o));
    }
  };

  const openDelete = (o: OrphanWithUi) => {
    if (o.kind === 'series') setConfirmTarget(o); else handleDelete(o.series_id, o.chapter_folder);
  };
  const confirmDeletion = () => { if (!confirmTarget) return; const t = confirmTarget; setConfirmTarget(null); handleDelete(t.series_id, t.chapter_folder); };

  const totalSizeMB = (orphans.reduce((acc, o) => acc + o.size_bytes, 0) / (1024 * 1024)).toFixed(2);
  const chapterOrphans = orphans.filter(o => o.kind !== 'series');
  const seriesOrphans = orphans.filter(o => o.kind === 'series');
  const chapterSizeMB = (chapterOrphans.reduce((a, o) => a + o.size_bytes, 0) / (1024 * 1024)).toFixed(2);
  const seriesSizeMB = (seriesOrphans.reduce((a, o) => a + o.size_bytes, 0) / (1024 * 1024)).toFixed(2);

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
              <h1 className="text-2xl font-light text-slate-900 tracking-tight">Orphan Directories</h1>
            </div>
            <button 
              onClick={loadOrphans} 
              disabled={refreshing} 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <p className="text-sm text-slate-500 max-w-3xl leading-relaxed">
            Directories in your manga library that are no longer referenced. Clean up to reclaim disk space.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-500">Loading orphan directories…</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Failed to load orphans</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && orphans.length === 0 && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-8 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 mb-4">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-emerald-900 mb-1">All Clean</h3>
            <p className="text-sm text-emerald-700">No orphan directories detected. Your library is optimized.</p>
          </div>
        )}

        {/* Orphan Table */}
        {orphans.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Series ID</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Chapter</th>
                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-3.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Files</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Path</th>
                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orphans.map(o => {
                    const sizeMB = (o.size_bytes / (1024 * 1024)).toFixed(2);
                    return (
                      <tr key={`${o.series_id}/${o.chapter_folder || '__series__'}`} className="hover:bg-slate-50/50 transition-colors duration-150">
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${o.kind === 'series' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700'}`}>
                            {o.kind === 'series' ? 'Series' : 'Chapter'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-900">{o.series_id}</td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-600">
                          {o.chapter_folder || <span className="italic text-slate-400">entire series</span>}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">{sizeMB} MB</td>
                        <td className="px-6 py-4 text-center text-sm text-slate-600">{o.file_count}</td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500 max-w-xs truncate" title={o.rel_path}>{o.rel_path}</td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => openDelete(o)} 
                            disabled={o.deleting} 
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-rose-500 hover:bg-rose-600 active:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm hover:shadow"
                            title={o.kind === 'series' ? 'Delete entire unused series directory' : 'Delete orphan chapter directory'}
                          >
                            {o.deleting ? (
                              <>
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                </svg>
                                Deleting
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </>
                            )}
                          </button>
                          {o.error && <p className="text-xs text-rose-600 mt-1.5">{o.error}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        {orphans.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total</p>
                  <p className="text-2xl font-semibold text-slate-900 mt-1">{orphans.length}</p>
                </div>
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-violet-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-violet-600 uppercase tracking-wide">Series</p>
                  <p className="text-2xl font-semibold text-violet-900 mt-1">{seriesOrphans.length}</p>
                  <p className="text-xs text-violet-600 mt-0.5">{seriesSizeMB} MB</p>
                </div>
                <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-sky-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-sky-600 uppercase tracking-wide">Chapters</p>
                  <p className="text-2xl font-semibold text-sky-900 mt-1">{chapterOrphans.length}</p>
                  <p className="text-xs text-sky-600 mt-0.5">{chapterSizeMB} MB</p>
                </div>
                <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-amber-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">Reclaimable</p>
                  <p className="text-2xl font-semibold text-amber-900 mt-1">{totalSizeMB}</p>
                  <p className="text-xs text-amber-600 mt-0.5">MB</p>
                </div>
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Confirmation Modal */}
        {confirmTarget && (
          <div className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-slate-900">Confirm Deletion</h2>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                      You are about to permanently delete this series directory:
                    </p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs font-mono text-slate-700 break-all">/library/{confirmTarget.series_id}</p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Files</p>
                      <p className="font-semibold text-slate-900">{confirmTarget.file_count}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Size</p>
                      <p className="font-semibold text-slate-900">{(confirmTarget.size_bytes / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                  <p className="text-xs text-rose-900 leading-relaxed">
                    <strong className="font-semibold">Warning:</strong> This action cannot be undone. All files will be permanently removed.
                  </p>
                </div>
              </div>
              <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-200">
                <button 
                  onClick={() => setConfirmTarget(null)} 
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDeletion} 
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 active:bg-rose-800 shadow-sm hover:shadow transition-all duration-200"
                >
                  Delete Directory
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OrphanClient;