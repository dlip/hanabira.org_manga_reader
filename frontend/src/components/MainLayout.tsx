'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import MokuroViewer from '@/components/MokuroViewer';
import TextSidebar from '@/components/TextSidebar';
import SRSReview from '@/components/SRSReview';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import BookmarksPanel from '@/components/BookmarksPanel';
import ThemeSettings from '@/components/ThemeSettings';
import { ToastProvider, useToast } from '@/components/Toast';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { SRSManager } from '@/lib/srs';
import { ContentManager } from '@/lib/content';
import EmptyStateLanding from '@/components/EmptyStateLanding';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

function MainLayoutContent() {
  const searchParams = useSearchParams();
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [showSRSReview, setShowSRSReview] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showThemeSettings, setShowThemeSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false); // placeholder retained if needed later
  const [reviewsAvailable, setReviewsAvailable] = useState(0);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const { addToast } = useToast();
  const { theme, toggleTheme } = useTheme();

  // Stable primitive for chapter param to avoid re-running effects on object identity changes
  const chapterParam = useMemo(() => searchParams?.get('chapter') ?? null, [searchParams]);

  useEffect(() => {
    // Check for chapter parameter in URL
    if (chapterParam) {
      setCurrentChapterId(chapterParam);
    } else {
      setCurrentChapterId(null);
    }
  }, [chapterParam]);

  // Determine if we are in landing (no chapter selected)
  const isLanding = !currentChapterId;

  useEffect(() => {
    // Listen for page updates from mokuro iframe
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from our domain or the iframe
      if (event.origin !== window.location.origin && event.origin !== 'null') {
        return;
      }
      
      if (event.data && event.data.type === 'mokuro-page-update' && event.data.page) {
        setCurrentPage(event.data.page);
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Track last read URI when a chapter is opened
  useEffect(() => {
    if (currentChapterId) {
      // Store the current URI as the last read
      const currentUri = `/?chapter=${currentChapterId}`;
      localStorage.setItem('lastReadUri', currentUri);
      localStorage.setItem('lastReadTime', Date.now().toString());
      console.log('Saved last read URI:', currentUri);
    }
  }, [currentChapterId]);

  // Apply overflow hidden to body only when viewing manga (not on landing page)
  useEffect(() => {
    if (!isLanding) {
      document.body.classList.add('overflow-hidden-page');
    } else {
      document.body.classList.remove('overflow-hidden-page');
    }
    return () => {
      document.body.classList.remove('overflow-hidden-page');
    };
  }, [isLanding]);

  const isCountingRef = useRef(false);
  const lastCountRef = useRef<number | null>(null);

  useEffect(() => {
    // Check for reviews available
    const updateReviewCount = async () => {
      if (isCountingRef.current) return;
      isCountingRef.current = true;
      try {
        const dueIds = await SRSManager.getCardsForReview();
        // The backend API already returns valid due cards, so we can use the count directly
        const count = dueIds.length;
        if (lastCountRef.current !== count) {
          lastCountRef.current = count;
          setReviewsAvailable(count);
        }
      } catch (e) {
        console.warn('Failed to compute review count:', e);
        setReviewsAvailable(0);
      } finally {
        isCountingRef.current = false;
      }
    };

    updateReviewCount();
    
    // Update review count every minute
    const interval = setInterval(updateReviewCount, 60000);

    // Listen for SRS review updates
    const handleSRSUpdate = () => {
      updateReviewCount();
    };
    window.addEventListener('srs-review-updated', handleSRSUpdate);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle sidebar with 'S' key
      if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Only toggle if not typing in an input field
        if (document.activeElement?.tagName !== 'INPUT' && 
            document.activeElement?.tagName !== 'TEXTAREA') {
          setSidebarVisible(prev => !prev);
        }
      }
      // Open SRS review with 'R' key
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (document.activeElement?.tagName !== 'INPUT' && 
            document.activeElement?.tagName !== 'TEXTAREA') {
          setShowSRSReview(true);
        }
      }
      // Open analytics with 'A' key
      if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (document.activeElement?.tagName !== 'INPUT' && 
            document.activeElement?.tagName !== 'TEXTAREA') {
          setShowAnalytics(true);
        }
      }
      // Open bookmarks with 'B' key
      if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (document.activeElement?.tagName !== 'INPUT' && 
            document.activeElement?.tagName !== 'TEXTAREA') {
          setShowBookmarks(true);
        }
      }
      // Open theme settings with 'T' key
      if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (document.activeElement?.tagName !== 'INPUT' && 
            document.activeElement?.tagName !== 'TEXTAREA') {
          setShowThemeSettings(true);
        }
      }
    };

    const offlineQueued = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      addToast(`Queued review offline${detail?.card_id ? ' #' + detail.card_id : ''}`, 'info', 2500);
    };
    const offlineFlushed = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      addToast(`Synced ${detail?.flushed || 0} pending review(s)`, 'success', 3000);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('srs-offline-queued', offlineQueued as EventListener);
    window.addEventListener('srs-offline-flushed', offlineFlushed as EventListener);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('srs-review-updated', handleSRSUpdate);
      window.removeEventListener('srs-offline-queued', offlineQueued as EventListener);
      window.removeEventListener('srs-offline-flushed', offlineFlushed as EventListener);
      clearInterval(interval);
    };
  }, [addToast]);

  return (
      <div className="flex h-screen bg-gray-100 relative">
      {/* Vertical Navigation - Left Side */}
      <div className="fixed left-4 top-1/2 transform -translate-y-1/2 z-50 flex flex-col gap-3">
        <Link
          href="/"
          className="bg-green-500 hover:bg-green-600 text-white p-3 rounded-lg shadow-lg transition-colors flex items-center justify-center group"
          title="Home"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-green-600 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Home
          </span>
        </Link>
        
        <Link
          href="/library"
          className="bg-indigo-500 hover:bg-indigo-600 text-white p-3 rounded-lg shadow-lg transition-colors flex items-center justify-center group"
          title="Manga Library"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-indigo-600 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Library
          </span>
        </Link>
        
        <Link
          href="/flashcards"
          className="bg-purple-500 hover:bg-purple-600 text-white p-3 rounded-lg shadow-lg transition-colors flex items-center justify-center group"
          title="View Flashcards"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-purple-600 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Flashcards
          </span>
        </Link>
        
        <Link
          href="/database"
          className="bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-lg shadow-lg transition-colors flex items-center justify-center group"
          title="View Database"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-700 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Database
          </span>
        </Link>
        
        <Link
          href="/admin"
          className="bg-orange-500 hover:bg-orange-600 text-white p-3 rounded-lg shadow-lg transition-colors flex items-center justify-center group"
          title="Admin Panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-orange-600 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Admin Panel
          </span>
        </Link>
        
        <button
          onClick={async () => {
            // Before opening, verify there are due cards; if none, show toast instead
            try {
              const dueIds = await SRSManager.getCardsForReview();
              if (dueIds.length === 0) {
                addToast('No cards are due right now – great job! 🎉', 'info', 3500);
                return;
              }
            } catch {
              addToast('Unable to load due cards (offline?)', 'error', 3000);
              return;
            }
            setShowSRSReview(true);
          }}
          className={`relative p-3 rounded-lg shadow-lg transition-colors flex items-center justify-center group text-white ${
            reviewsAvailable > 0 
              ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
              : 'bg-green-500 hover:bg-green-600'
          }`}
          title={`SRS Review - ${reviewsAvailable} cards due (Press 'R')`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          {reviewsAvailable > 0 && (
            <span className="absolute -top-1 -right-1 bg-white text-red-600 text-xs rounded-full px-1.5 py-0.5 font-bold min-w-[20px] text-center border border-red-200">
              {reviewsAvailable}
            </span>
          )}
          <span className={`absolute left-full ml-2 px-2 py-1 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ${
            reviewsAvailable > 0 ? 'bg-red-600' : 'bg-green-600'
          }`}>
            Review ({reviewsAvailable}) - Press R
          </span>
        </button>
        <button
          onClick={() => setShowAnalytics(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg shadow-lg transition-colors flex items-center justify-center group"
          title="Analytics Dashboard (Press 'A')"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-blue-600 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Analytics - Press A
          </span>
        </button>
        
        <button
          onClick={() => setShowBookmarks(true)}
          className="bg-yellow-500 hover:bg-yellow-600 text-white p-3 rounded-lg shadow-lg transition-colors flex items-center justify-center group"
          title="Bookmarks (Press 'B')"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-yellow-600 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Bookmarks - Press B
          </span>
        </button>
        
        <button
          onClick={() => setShowThemeSettings(true)}
          className="bg-gray-500 hover:bg-gray-600 text-white p-3 rounded-lg shadow-lg transition-colors flex items-center justify-center group"
          title="Theme Settings (Press 'T')"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-600 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Theme - Press T
          </span>
        </button>


        <button
          onClick={() => setShowAbout(true)}
          className="bg-teal-500 hover:bg-teal-600 text-white p-3 rounded-lg shadow-lg transition-colors flex items-center justify-center group"
          title="About"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-teal-600 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            About
          </span>
        </button>

        {/* Spacer to push theme toggle to bottom */}
        <div className="h-8"></div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="bg-slate-600 hover:bg-slate-700 text-white p-3 rounded-lg shadow-lg transition-colors flex items-center justify-center group"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <SunIcon className="w-5 h-5" />
          ) : (
            <MoonIcon className="w-5 h-5" />
          )}
          <span className="absolute left-full ml-2 px-2 py-1 bg-slate-700 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </span>
        </button>
      </div>

      {/* Toggle Button */}
      {!isLanding && (
        <button
          onClick={() => setSidebarVisible(!sidebarVisible)}
          className={`fixed bottom-4 z-50 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg transition-all duration-300 flex items-center gap-2 text-sm ${
            sidebarVisible ? 'right-80' : 'right-4'
          }`}
          title="Toggle sidebar (Press 'S')"
        >
          <svg
            className={`w-4 h-4 transition-transform ${sidebarVisible ? 'rotate-0' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            suppressHydrationWarning
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 5l7 7-7 7M5 5l7 7-7 7"
            />
          </svg>
          <span className="hidden sm:inline">
            {sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
          </span>
          <span className="text-xs opacity-75">(S)</span>
        </button>
      )}

      {/* Main Content */}
      <div className={`${!isLanding && sidebarVisible ? 'flex-1' : 'w-full'} pl-16`}>
        {isLanding ? (
          <EmptyStateLanding className="p-8" />
        ) : (
          <MokuroViewer className="h-full" chapterId={currentChapterId || undefined} />
        )}
      </div>
      
      {/* Text Sidebar */}
      {!isLanding && sidebarVisible && (
        <div className="w-1/3 min-w-[300px] max-w-[500px] shadow-lg">
          <TextSidebar className="h-full" />
        </div>
      )}

      {/* SRS Review Modal */}
      {showSRSReview && (
        <SRSReview
          onClose={() => setShowSRSReview(false)}
          onComplete={(reviewsCompleted) => {
            setShowSRSReview(false);
            // Optimistically decrement, then schedule a recount to stay in sync with backend/local logic
            setReviewsAvailable(prev => Math.max(0, prev - reviewsCompleted));
            // Recount shortly after modal close to capture any newly due cards (e.g., failed reviews returning to queue)
            setTimeout(async () => {
              try {
                const dueIds = await SRSManager.getCardsForReview();
                setReviewsAvailable(dueIds.length);
              } catch (e) {
                console.warn('Failed to refresh review count after completion:', e);
              }
            }, 300);
            addToast(
              `🎉 Great job! You reviewed ${reviewsCompleted} card${reviewsCompleted !== 1 ? 's' : ''}!`,
              'success',
              4000
            );
          }}
        />
      )}

      {/* Analytics Dashboard Modal */}
      {showAnalytics && (
        <AnalyticsDashboard
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {/* Bookmarks Panel */}
      {showBookmarks && (
        <BookmarksPanel
          isOpen={showBookmarks}
          onClose={() => setShowBookmarks(false)}
          currentChapterId={currentChapterId || undefined}
          currentPage={currentPage || undefined}
          onBookmarkClick={async (bookmark) => {
            try {
              // Navigate to the bookmark location - go to specific chapter and page if possible
              const chapter = await ContentManager.getChapterById(bookmark.chapterId);
              if (chapter) {
                window.location.href = `/?chapter=${bookmark.chapterId}#page=${bookmark.pageNumber}`;
              } else {
                // Fallback to series page
                window.location.href = `/series/${bookmark.seriesId}`;
              }
            } finally {
              setShowBookmarks(false);
            }
          }}
        />
      )}

      {/* Theme Settings */}
      <ThemeSettings
        isOpen={showThemeSettings}
        onClose={() => setShowThemeSettings(false)}
      />


      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAbout(false)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800">About</h3>
              <button
                onClick={() => setShowAbout(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close About"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                This application was built by{' '}
                <a
                  href="https://hanabira.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-600 hover:underline"
                >
                  hanabira.org
                </a>.
              </p>
              <p>
                GitHub:{' '}
                <a
                  href="https://github.com/tristcoil/hanabira.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline"
                >
                  tristcoil/hanabira.org
                </a>
              </p>
              <p>
                Uses:{' '}
                <a
                  href="https://github.com/kha-white/mokuro"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline"
                >
                  Mokuro
                </a>
                {' '}for OCR manga files
              </p>
              <p>
                Legal manga:{' '}
                <a
                  href="https://bookwalker.jp/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline"
                >
                  BookWalker
                </a>
              </p>
              <p>
                License: <span className="font-mono bg-gray-100 px-1 rounded">MIT</span>
              </p>
              <p>
                Version: <span className="font-mono bg-gray-100 px-1 rounded">v0.1.0</span>
              </p>
              <div className="pt-2 border-t border-gray-200 mt-3">
                <p className="font-medium text-gray-800 mb-1">Community</p>
                <ul className="space-y-1">
                  <li>
                    <a
                      href="https://www.reddit.com/r/hanabira/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <circle cx="9" cy="13" r="1" />
                        <circle cx="15" cy="13" r="1" />
                        <path d="M7.5 17c1 .667 2.333 1 3.5 1s2.5-.333 3.5-1" />
                        <path d="M14.5 3.5 12 5l-2.5-1.5" />
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                      r/hanabira (Reddit)
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://discord.gg/afefVyfAkH"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M7.5 4.5c1.5-.5 2.5-.5 4-.5l.5 1s1.5 0 3 .5l.5-1c1.5 0 2.5 0 4 .5 1 3 1 6 1 9 0 0-1.5 2-5.5 2l-1-.5-.5.5c-4 0-5.5-2-5.5-2 0-3 0-6 1-9Z" />
                        <circle cx="9" cy="12" r="1" />
                        <circle cx="15" cy="12" r="1" />
                      </svg>
                      Discord Server
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowAbout(false)}
                className="px-3 py-1.5 text-sm bg-teal-500 hover:bg-teal-600 text-white rounded-md shadow"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MainLayout() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <MainLayoutContent />
      </ToastProvider>
    </ThemeProvider>
  );
}
