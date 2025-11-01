"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface EmptyStateLandingProps {
  className?: string;
}

export default function EmptyStateLanding({ className = '' }: EmptyStateLandingProps) {
  const [lastReadUri, setLastReadUri] = useState<string | null>(null);
  const [lastReadTime, setLastReadTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLastRead = () => {
      try {
        console.log('Loading last read URI...');
        const uri = localStorage.getItem('lastReadUri');
        const time = localStorage.getItem('lastReadTime');
        
        console.log('Last read URI:', uri);
        console.log('Last read time:', time);
        
        if (uri && time) {
          setLastReadUri(uri);
          setLastReadTime(parseInt(time));
        }
      } catch (error) {
        console.error('Error loading last read URI:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLastRead();
  }, []);

  const formatLastReadDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div
      className={`w-full min-h-screen flex items-center justify-center bg-seigaiha ${className}`}
    >
      <div className="text-center max-w-xl mx-auto p-8 rounded-2xl bg-white/70 backdrop-blur-sm shadow-lg border border-gray-200">
        <a
          href="https://hanabira.org"
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto mb-6 h-12 w-12 flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
          aria-label="Visit hanabira.org"
        >
          {/* Custom logo: 花 (hana) kanji in circle */}
          <svg className="w-12 h-12" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden suppressHydrationWarning>
            <circle cx="50" cy="50" r="48" stroke="#3b82f6" strokeWidth="3" fill="none"/>
            <text x="50" y="72" fontSize="48" fontWeight="500" textAnchor="middle" fill="#3b82f6" fontFamily="serif">花</text>
          </svg>
          
          {/* Bookmark icon - commented out */}
          {/* <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden suppressHydrationWarning>
            <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-6-3-6 3V4z" />
          </svg> */}
        </a>

        <div className="text-sm font-medium text-gray-600 mb-0">
          <a
            href="https://hanabira.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-700 hover:underline"
          >
            hanabira.org
          </a>
        </div>
        <h1 className="text-2xl font-semibold text-gray-800 mt-1">Manga Reader</h1>
        <div className="text-xs text-gray-500 mb-4">Uses Mokuro library (.mokuro manga files)</div>
        
        {/* Debug info */}
        <div className="mb-4 text-xs text-gray-500">
          Status: {loading ? 'Loading...' : `Loaded - Last URI: ${lastReadUri ? 'Found' : 'None'}`}
          {lastReadUri && ` | URI: ${lastReadUri}`}
          <button 
            onClick={() => {
              console.log('Last read URI:', localStorage.getItem('lastReadUri'));
              console.log('Last read time:', localStorage.getItem('lastReadTime'));
            }}
            className="ml-2 px-2 py-1 bg-gray-500 text-white rounded text-xs"
          >
            Check URI
          </button>
        </div>
        
        {!loading && lastReadUri && lastReadTime ? (
          <div className="mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center mb-2">
                <svg className="w-4 h-4 mr-2 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
                <span className="text-sm text-blue-600 font-medium">Continue Reading</span>
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">Last Read Chapter</h3>
              <p className="text-sm text-gray-600 mb-2">
                Return to where you left off
              </p>
              <p className="text-xs text-gray-500 mb-3">
                Last read: {formatLastReadDate(lastReadTime)}
              </p>
              <Link
                href={lastReadUri}
                className="inline-block px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium shadow transition-colors"
              >
                Resume Reading
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 mb-6">
            Your library is empty here. Add a series in the Library to start reading.
          </p>
        )}
        
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/library"
            className="px-4 py-2 rounded-lg bg-sky-400 hover:bg-sky-500 text-white shadow transition-colors"
          >
            Open Library
          </Link>
          <Link
            href="/flashcards"
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 transition-colors"
          >
            View Flashcards
          </Link>
        </div>
        <div className="mt-6 text-xs text-gray-400">
          Tip: Press R for reviews, A for analytics, T for theme.
        </div>
      </div>
    </div>
  );
}
