'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import Image from 'next/image';
import { FlashcardManager, type Flashcard } from '@/lib/flashcards';
import { useToast } from '@/components/Toast';
import FuriganaText from '@/components/FuriganaText';

type LayoutVariant = 'card' | 'compact' | 'list' | 'table';

export default function FlashcardsPage() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [selectedCard, setSelectedCard] = useState<Flashcard | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'study'>('grid');
  const [layoutVariant, setLayoutVariant] = useState<LayoutVariant>('card');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [isShuffled, setIsShuffled] = useState(false);
  const [studyStreak, setStudyStreak] = useState(0);
  const [studyProgress, setStudyProgress] = useState(0);
  const [showGrammarInStudy, setShowGrammarInStudy] = useState(false);
  const [showGrammarDetail, setShowGrammarDetail] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    loadFlashcards();
    loadStudyStreak();
    // restore layout
    const savedLayout = localStorage.getItem('flashcards_layout_variant') as LayoutVariant | null;
    if (savedLayout === 'card' || savedLayout === 'compact' || savedLayout === 'list' || savedLayout === 'table') {
      setLayoutVariant(savedLayout);
    }
  }, []);

  const loadStudyStreak = () => {
    const streak = localStorage.getItem('studyStreak');
    const lastStudyDate = localStorage.getItem('lastStudyDate');
    const today = new Date().toDateString();
    
    if (lastStudyDate === today) {
      setStudyStreak(streak ? parseInt(streak) : 0);
    } else if (lastStudyDate) {
      const lastDate = new Date(lastStudyDate);
      const todayDate = new Date();
      const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        // Continue streak
        setStudyStreak(streak ? parseInt(streak) : 0);
      } else {
        // Streak broken
        setStudyStreak(0);
        localStorage.setItem('studyStreak', '0');
      }
    }
  };

  const updateStudyStreak = useCallback(() => {
    const today = new Date().toDateString();
    const lastStudyDate = localStorage.getItem('lastStudyDate');
    
    if (lastStudyDate !== today) {
      const newStreak = studyStreak + 1;
      setStudyStreak(newStreak);
      localStorage.setItem('studyStreak', newStreak.toString());
      localStorage.setItem('lastStudyDate', today);
    }
  }, [studyStreak]);

  const loadFlashcards = async () => {
    try {
      const cards = await FlashcardManager.getFlashcards();
      setFlashcards(cards);
    } catch (error) {
      console.error('Error loading flashcards:', error);
      setFlashcards([]); // Fallback to empty array
    }
  };

  // Reset grammar detail toggle whenever the detail modal card changes or closes
  useEffect(() => {
    setShowGrammarDetail(false);
  }, [selectedCard]);

  const exportFlashcards = () => {
    const data = FlashcardManager.exportFlashcards();
    downloadFile(data, `mokuro_flashcards_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  };

  const exportToAnki = () => {
    const data = FlashcardManager.exportToAnki();
    downloadFile(data, `mokuro_anki_deck_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  };

  const exportToCSV = () => {
    const data = FlashcardManager.exportToCSV();
    downloadFile(data, `mokuro_flashcards_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  };

  const createBackup = () => {
    const data = FlashcardManager.createBackup();
    downloadFile(data, `mokuro_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importFlashcards = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      if (await FlashcardManager.importFlashcards(content)) {
        await loadFlashcards();
        addToast('Flashcards imported successfully!', 'success');
      } else {
        addToast('Failed to import flashcards. Please check the file format.', 'error');
      }
    };
  reader.readAsText(file!);
  };

  const restoreBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

  setConfirmRestore(true);
  // actual restore will run on confirm modal
  return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      if (await FlashcardManager.restoreBackup(content)) {
        await loadFlashcards();
        addToast('Backup restored successfully! Please refresh the page.', 'success');
        window.location.reload();
      } else {
        addToast('Failed to restore backup. Please check the file format.', 'error');
      }
    };
  reader.readAsText(file!);
  };

  // Filter flashcards based on search and tag
  const filteredFlashcards = useMemo(() => {
    let filtered = flashcards.filter(card => {
      // Handle both new (front/back) and legacy (text) card formats
      const frontText = (card.front || card.text || '').toLowerCase();
      const backText = (card.back || '').toLowerCase();
      const readingText = (card.reading || '').toLowerCase();
  const notesText = (card.notes || '').toLowerCase();
  const grammarText = (card.grammar || '').toLowerCase();
      
  const matchesSearch = frontText.includes(searchTerm.toLowerCase()) ||
           backText.includes(searchTerm.toLowerCase()) ||
           readingText.includes(searchTerm.toLowerCase()) ||
           notesText.includes(searchTerm.toLowerCase()) ||
           grammarText.includes(searchTerm.toLowerCase());
      const matchesTag = !selectedTag || (card.tags && card.tags.includes(selectedTag));
      return matchesSearch && matchesTag;
    });

    // Shuffle if enabled
    if (isShuffled) {
      filtered = [...filtered].sort(() => Math.random() - 0.5);
    }
    
    return filtered;
  }, [flashcards, searchTerm, selectedTag, isShuffled]);

  // Define functions with useCallback to avoid dependency issues
  const updateStudyProgress = useCallback((index: number) => {
    if (filteredFlashcards.length > 0) {
      const progress = ((index + 1) / filteredFlashcards.length) * 100;
      setStudyProgress(progress);
    }
  }, [filteredFlashcards.length]);

  const nextCard = useCallback(() => {
    const newIndex = (currentIndex + 1) % filteredFlashcards.length;
    setCurrentIndex(newIndex);
    setShowAnswer(false);
    updateStudyProgress(newIndex);
    
    // Update study streak on first completion
    if (newIndex === 0 && currentIndex === filteredFlashcards.length - 1) {
      updateStudyStreak();
    }
  }, [currentIndex, filteredFlashcards.length, updateStudyProgress, updateStudyStreak]);

  const prevCard = useCallback(() => {
    const newIndex = (currentIndex - 1 + filteredFlashcards.length) % filteredFlashcards.length;
    setCurrentIndex(newIndex);
    setShowAnswer(false);
    updateStudyProgress(newIndex);
  }, [currentIndex, filteredFlashcards.length, updateStudyProgress]);

  const deleteFlashcard = useCallback(async (id: string) => {
    setConfirmDeleteId(id);
  }, []);

  const performDelete = useCallback(async () => {
    if (!confirmDeleteId) return;
    setBusy(true);
    try {
      const ok = await FlashcardManager.deleteFlashcard(confirmDeleteId);
      if (ok) {
        addToast('Flashcard deleted', 'success');
      } else {
        addToast('Flashcard not found or could not be deleted', 'error');
      }
      await loadFlashcards();
      if (selectedCard?.id === confirmDeleteId) {
        setSelectedCard(null);
      }
    } catch {
      addToast('Failed to delete flashcard', 'error');
    } finally {
      setBusy(false);
      setConfirmDeleteId(null);
    }
  }, [confirmDeleteId, selectedCard, addToast]);

  // Get all unique tags
  const allTags = Array.from(new Set(flashcards.flatMap(card => card.tags || [])));
  const changeLayout = (variant: LayoutVariant) => {
    setLayoutVariant(variant);
    try { localStorage.setItem('flashcards_layout_variant', variant); } catch {}
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in inputs
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      // Study mode shortcuts
      if (viewMode === 'study' && filteredFlashcards.length > 0) {
        switch (e.key) {
          case ' ':
          case 'Enter':
            e.preventDefault();
            setShowAnswer(!showAnswer);
            break;
          case 'ArrowLeft':
            e.preventDefault();
            prevCard();
            break;
          case 'ArrowRight':
            e.preventDefault();
            nextCard();
            break;
        }
      }

      // Global shortcuts
      if (e.key === 'Escape') {
        if (selectedCard) {
          setSelectedCard(null);
        } else if (viewMode === 'study') {
          setViewMode('grid');
        }
      }

      // Grid mode shortcuts
      if (viewMode === 'grid' && e.key === 'Delete' && selectedCard) {
        e.preventDefault();
        deleteFlashcard(selectedCard.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, showAnswer, selectedCard, filteredFlashcards.length, deleteFlashcard, nextCard, prevCard]);

  // Update study progress when in study mode
  useEffect(() => {
    if (viewMode === 'study' && filteredFlashcards.length > 0) {
      updateStudyProgress(currentIndex);
    }
  }, [viewMode, currentIndex, filteredFlashcards.length, updateStudyProgress]);

  if (viewMode === 'study' && filteredFlashcards.length > 0) {
    const currentCard = filteredFlashcards[currentIndex];
    
    return (
      <div className="min-h-screen bg-gray-100 p-4">
    <div className="max-w-4xl mx-auto">
          {/* Study Mode Header */}
          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center">
              <button
                onClick={() => setViewMode('grid')}
                className="flex items-center text-blue-600 hover:text-blue-800"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Grid
              </button>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setIsShuffled(!isShuffled)}
                  className={`flex items-center px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    isShuffled 
                      ? 'bg-purple-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Shuffle
                </button>
                
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-1 text-orange-500" fill="currentColor" viewBox="0 0 20 20" suppressHydrationWarning>
                    <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                  </svg>
                  {studyStreak} day streak
                </div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700 min-w-fit">
                Card {currentIndex + 1} of {filteredFlashcards.length}
              </span>
              <progress
                value={studyProgress}
                max={100}
                aria-label="Study progress"
                className="flex-1 h-2 rounded-full overflow-hidden align-middle 
                [&::-webkit-progress-bar]:bg-gray-200 
                [&::-webkit-progress-value]:bg-blue-500 
                [&::-moz-progress-bar]:bg-blue-500"
              />
              <span className="text-sm text-gray-600 min-w-fit">
                {Math.round(studyProgress)}%
              </span>
            </div>
          </div>

          {/* Study Card */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            {currentCard.image && (
              <div className="mb-6">
                <Image
                  src={currentCard.image}
                  alt="Flashcard"
                  width={800}
                  height={320}
                  className="w-full max-h-80 object-contain rounded-lg border"
                  unoptimized
                />
              </div>
            )}
            
            <div className="text-center mb-6">
              <div className="mb-4">
                <h3 className="text-sm text-gray-600 mb-2">Front (Japanese):</h3>
                <div className="text-3xl leading-relaxed mb-4 text-gray-900">
                  {currentCard.furigana ? (
                    <FuriganaText furiganaPairs={currentCard.furigana} showFurigana={true} />
                  ) : (
                    <span className="font-japanese">{currentCard.front || currentCard.text}</span>
                  )}
                </div>
                {currentCard.reading && (
                  <p className="text-lg font-japanese text-gray-700 mb-4">
                    {currentCard.reading}
                  </p>
                )}
              </div>
              
              {showAnswer && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="text-sm text-gray-600 mb-2">Back (Translation):</h3>
                  <p className="text-xl text-gray-900 mb-2">{currentCard.back || 'No translation available'}</p>
                  {currentCard.notes && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <h4 className="text-sm text-gray-600 mb-1">Notes:</h4>
                      <p className="text-gray-700">{currentCard.notes}</p>
                    </div>
                  )}
                  {currentCard.grammar && currentCard.grammar.trim() && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm text-green-800">Grammar Explanation</h4>
                        <button
                          type="button"
                          onClick={() => setShowGrammarInStudy(!showGrammarInStudy)}
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {showGrammarInStudy ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {showGrammarInStudy && (
                        <div className="max-h-64 overflow-y-auto border border-green-200 dark:border-green-800 rounded p-3 bg-green-50 dark:bg-green-900/20">
                          <div className="prose prose-sm prose-green max-w-none text-gray-800 dark:text-gray-100">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h2: ({...props}) => <h2 className="text-lg font-bold mt-4 mb-2 text-green-800" {...props} />,
                                h3: ({...props}) => <h3 className="text-base font-semibold mt-3 mb-1 text-green-700" {...props} />,
                                p: ({...props}) => <p className="mb-2" {...props} />,
                                ul: ({...props}) => <ul className="list-disc pl-4 mb-2" {...props} />,
                                strong: ({...props}) => <strong className="font-semibold text-green-900" {...props} />,
                                code: ({...props}) => <code className="bg-green-100 px-1 py-0.5 rounded text-sm font-mono" {...props} />
                              }}
                            >
                              {currentCard.grammar}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setShowAnswer(!showAnswer)}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                {showAnswer ? 'Hide Answer' : 'Show Answer'}
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <button
              onClick={prevCard}
              className="flex items-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            
            <button
              onClick={nextCard}
              className="flex items-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Next
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="flex items-center text-blue-600 hover:text-blue-800"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Reader
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">
              Flashcards ({flashcards.length})
            </h1>
          </div>

          <div className="flex space-x-2">
            {filteredFlashcards.length > 0 && (
              <button
                onClick={() => setViewMode('study')}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Study Mode
              </button>
            )}

            {/* Layout selector */}
            <div className="hidden md:block">
              <select
                value={layoutVariant}
                onChange={(e) => changeLayout(e.target.value as LayoutVariant)}
                className="p-2 border border-gray-300 rounded-lg text-gray-800 bg-white"
                title="Choose flashcards layout"
              >
                <option value="card">Card Grid</option>
                <option value="compact">Compact Grid</option>
                <option value="list">List</option>
                <option value="table">Table</option>
              </select>
            </div>
            
            {/* Export Dropdown */}
            <div className="relative group">
              <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                <button
                  onClick={exportFlashcards}
                  className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-t-lg"
                >
                  JSON Format
                </button>
                <button
                  onClick={exportToCSV}
                  className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                >
                  CSV Format
                </button>
                <button
                  onClick={exportToAnki}
                  className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                >
                  Anki Deck
                </button>
                <button
                  onClick={createBackup}
                  className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-b-lg border-t"
                >
                  Full Backup
                </button>
              </div>
            </div>
            
            {/* Import Dropdown */}
            <div className="relative group">
              <button className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                Import
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                <label className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-t-lg cursor-pointer block">
                  Flashcards (JSON)
                  <input
                    type="file"
                    accept=".json"
                    onChange={importFlashcards}
                    className="hidden"
                  />
                </label>
                <label className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-b-lg border-t cursor-pointer block">
                  Restore Backup
                  <input
                    type="file"
                    accept=".json"
                    onChange={restoreBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search flashcards..."
                className="w-full p-2 border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400"
              />
            </div>
            
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg bg-white text-gray-800"
              title="Filter by tag"
            >
              <option value="">All Tags</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>

            {/* Mobile layout selector */}
            <div className="md:hidden">
              <select
                value={layoutVariant}
                onChange={(e) => changeLayout(e.target.value as LayoutVariant)}
                className="p-2 border border-gray-300 rounded-lg bg-white text-gray-800"
                title="Choose layout"
              >
                <option value="card">Card Grid</option>
                <option value="compact">Compact Grid</option>
                <option value="list">List</option>
                <option value="table">Table</option>
              </select>
            </div>
          </div>
        </div>

        {/* Flashcards Views */}
        {filteredFlashcards.length === 0 ? (
              <div className="text-center py-12">
            <div className="text-gray-700 mb-4">
              <svg className="mx-auto h-24 w-24 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {flashcards.length === 0 ? 'No flashcards yet' : 'No flashcards match your filters'}
            </div>
            <p className="text-lg text-gray-700 mb-4">
              {flashcards.length === 0 
                ? 'Start creating flashcards from the manga reader!'
                : 'Try adjusting your search or tag filters.'
              }
            </p>
            <Link
              href="/"
              className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Go to Reader
            </Link>
          </div>
        ) : (
          <>
            {layoutVariant === 'card' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredFlashcards.map((flashcard) => {
                  const getDifficultyColor = (difficulty?: string) => {
                    switch (difficulty) {
                      case 'easy': return 'border-l-4 border-green-400';
                      case 'medium': return 'border-l-4 border-yellow-400';
                      case 'hard': return 'border-l-4 border-red-400';
                      default: return 'border-l-4 border-gray-300';
                    }
                  };
                  return (
                    <div
                      key={flashcard.id}
                      className={`bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer ${getDifficultyColor(flashcard.difficulty)}`}
                      onClick={() => setSelectedCard(flashcard)}
                    >
                      {flashcard.image && (
                        <Image src={flashcard.image} alt="Flashcard" width={800} height={192} className="w-full h-48 object-cover" unoptimized />
                      )}
                      <div className="p-4">
                        <div className="mb-3">
                          <div className="text-lg leading-relaxed mb-1 line-clamp-2 text-gray-900 font-medium">
                            {flashcard.furigana ? (
                              <FuriganaText furiganaPairs={flashcard.furigana} showFurigana={true} />
                            ) : (
                              <span className="font-japanese">{flashcard.front || flashcard.text}</span>
                            )}
                          </div>
                          {flashcard.reading && (
                            <p className="text-sm font-japanese text-gray-600 mb-2">{flashcard.reading}</p>
                          )}
                          <p className="text-sm text-gray-700 line-clamp-2">{flashcard.back || 'No translation'}</p>
                        </div>
                        {flashcard.notes && (
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{flashcard.notes}</p>
                        )}
                        {flashcard.grammar && (
                          <div className="mt-2 p-2 bg-green-50 rounded border border-green-200 text-xs">
                            <div className="prose prose-xs prose-green max-w-none text-gray-800 line-clamp-4">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  h2: ({...props}) => <h4 className="text-sm font-semibold mt-2 mb-1 text-green-800" {...props} />,
                                  h3: ({...props}) => <h5 className="text-xs font-medium mt-1 mb-1 text-green-700" {...props} />,
                                  p: ({...props}) => <p className="text-xs mb-1" {...props} />,
                                  ul: ({...props}) => <ul className="list-disc pl-3 mb-1 text-xs" {...props} />,
                                  strong: ({...props}) => <strong className="font-medium text-green-900" {...props} />,
                                  code: ({...props}) => <code className="bg-green-100 px-1 rounded text-xs font-mono" {...props} />
                                }}
                              >
                                {flashcard.grammar}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <div className="flex flex-wrap gap-1">
                            {flashcard.tags?.slice(0, 2).map(tag => (
                              <span key={tag} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">{tag}</span>
                            ))}
                            {flashcard.tags && flashcard.tags.length > 2 && (
                              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">+{flashcard.tags.length - 2}</span>
                            )}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteFlashcard(flashcard.id); }}
                            className="text-red-500 hover:text-red-700 transition-colors"
                            title="Delete flashcard"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                        <div className="text-xs text-gray-600 mt-2">{new Date(flashcard.timestamp).toLocaleDateString()}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {layoutVariant === 'compact' && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {filteredFlashcards.map((fc) => (
                  <div key={fc.id} className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow cursor-pointer" onClick={() => setSelectedCard(fc)}>
                    <p className="text-base font-japanese line-clamp-2 text-gray-900">{fc.front || fc.text}</p>
                    {fc.reading && <p className="text-xs text-gray-600">{fc.reading}</p>}
                    <p className="text-xs text-gray-700 line-clamp-2 mt-1">{fc.back || 'No translation'}</p>
                    <div className="flex justify-between items-center mt-2">
                      <div className="flex gap-1 flex-wrap">
                        {fc.tags?.slice(0, 1).map(tag => <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-700 rounded">{tag}</span>)}
                        {fc.tags && fc.tags.length > 1 && <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded">+{fc.tags.length - 1}</span>}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteFlashcard(fc.id); }}
                        className="text-red-500 hover:text-red-700"
                        title="Delete flashcard"
                        aria-label="Delete flashcard"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {layoutVariant === 'list' && (
              <div className="bg-white rounded-lg shadow divide-y">
                {filteredFlashcards.map((fc) => (
                  <div key={fc.id} className="p-4 flex items-start justify-between gap-3 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-japanese text-lg text-gray-900 dark:text-gray-100 truncate">{fc.front || fc.text}</p>
                        {fc.reading && <span className="text-sm text-gray-600 dark:text-gray-300">{fc.reading}</span>}
                        {fc.difficulty && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{fc.difficulty}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 line-clamp-1">{fc.back || 'No translation'}</p>
                      {fc.tags && fc.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-2">
                          {fc.tags.slice(0,4).map(tag => (
                            <span key={tag} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 rounded">{tag}</span>
                          ))}
                          {fc.tags.length > 4 && <span className="text-xs text-gray-600 dark:text-gray-300">+{fc.tags.length - 4} more</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {fc.image && <Image src={fc.image} alt="Flashcard" width={64} height={48} className="w-16 h-12 object-cover rounded border" unoptimized />}
                      <div className="text-xs text-gray-600 dark:text-gray-300 w-24 text-right">{new Date(fc.timestamp).toLocaleDateString()}</div>
                      <button onClick={() => setSelectedCard(fc)} className="px-2 py-1 text-sm border rounded dark:border-gray-600 dark:text-gray-100">Open</button>
                      <button onClick={() => deleteFlashcard(fc.id)} className="px-2 py-1 text-sm text-red-600 border border-red-200 dark:border-red-800 rounded">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {layoutVariant === 'table' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="text-left px-4 py-2">Front</th>
                      <th className="text-left px-4 py-2">Back</th>
                      <th className="text-left px-4 py-2">Reading</th>
                      <th className="text-left px-4 py-2">Tags</th>
                      <th className="text-left px-4 py-2">Difficulty</th>
                      <th className="text-left px-4 py-2">Created</th>
                      <th className="text-left px-4 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFlashcards.map((fc) => (
                      <tr key={fc.id} className="border-t dark:border-gray-700">
                        <td className="px-4 py-2 max-w-xs"><div className="font-japanese truncate text-gray-900 dark:text-gray-100" title={fc.front || fc.text || ''}>{fc.front || fc.text}</div></td>
                        <td className="px-4 py-2 max-w-xs"><div className="truncate text-gray-700 dark:text-gray-300" title={fc.back || ''}>{fc.back}</div></td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{fc.reading}</td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1 flex-wrap">
                            {fc.tags?.slice(0,3).map(tag => <span key={tag} className="px-2 py-0.5 text-xs bg-gray-100 rounded">{tag}</span>)}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{fc.difficulty}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{new Date(fc.timestamp).toLocaleDateString()}</td>
                        <td className="px-4 py-2">
                          <div className="flex gap-2">
                            <button onClick={() => setSelectedCard(fc)} className="px-2 py-1 text-sm border rounded dark:border-gray-600 dark:text-gray-100">Open</button>
                            <button onClick={() => deleteFlashcard(fc.id)} className="px-2 py-1 text-sm text-red-600 border border-red-200 dark:border-red-800 rounded">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Detail Modal */}
        {selectedCard && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Flashcard Details</h2>
                  <button
                    onClick={() => setSelectedCard(null)}
                    className="text-gray-600 hover:text-gray-800 text-2xl"
                  >
                    ×
                  </button>
                </div>

                {selectedCard.image && (
                  <Image
                    src={selectedCard.image}
                    alt="Flashcard"
                    width={800}
                    height={320}
                    className="w-full max-h-80 object-contain rounded-lg border mb-4"
                    unoptimized
                  />
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-800 mb-2">Front (Japanese):</h3>
                    <div className="text-xl leading-relaxed text-gray-900 mb-3">
                      {selectedCard.furigana ? (
                        <FuriganaText furiganaPairs={selectedCard.furigana} showFurigana={true} />
                      ) : (
                        <span className="font-japanese">{selectedCard.front || selectedCard.text}</span>
                      )}
                    </div>
                    {selectedCard.reading && (
                      <div className="mb-3">
                        <h3 className="text-sm font-medium text-gray-800 mb-2">Reading:</h3>
                        <p className="text-lg font-japanese text-gray-700">{selectedCard.reading}</p>
                      </div>
                    )}
                    <h3 className="text-sm font-medium text-gray-800 mb-2">Back (Translation):</h3>
                    <p className="text-lg text-gray-900">{selectedCard.back || 'No translation available'}</p>
                  </div>

                  {selectedCard.notes && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-800 mb-2">Notes:</h3>
                      <p className="text-gray-900">{selectedCard.notes}</p>
                    </div>
                  )}
                  {selectedCard.grammar && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-800">Grammar Explanation:</h3>
                        <button
                          onClick={() => setShowGrammarDetail(!showGrammarDetail)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          {showGrammarDetail ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {showGrammarDetail && (
                        <div className="max-h-64 overflow-y-auto border-2 border-blue-200 rounded-lg p-4 bg-blue-50 shadow-sm">
                          <div className="prose prose-sm max-w-none text-gray-900 leading-relaxed">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h2: ({...props}) => <h2 className="text-lg font-bold mt-4 mb-2 text-blue-900" {...props} />,
                                h3: ({...props}) => <h3 className="text-base font-semibold mt-3 mb-1 text-blue-800" {...props} />,
                                p: ({...props}) => <p className="mb-2 text-gray-800" {...props} />,
                                ul: ({...props}) => <ul className="list-disc pl-4 mb-2 text-gray-800" {...props} />,
                                strong: ({...props}) => <strong className="font-semibold text-blue-900" {...props} />,
                                code: ({...props}) => <code className="bg-blue-100 text-blue-900 px-1 py-0.5 rounded text-sm font-mono" {...props} />
                              }}
                            >
                              {selectedCard.grammar}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedCard.tags && selectedCard.tags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-800 mb-2">Tags:</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedCard.tags.map(tag => (
                          <span
                            key={tag}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-gray-700">
                    Created: {new Date(selectedCard.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Delete Modal */}
        {confirmDeleteId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete flashcard?</h3>
              <p className="text-sm text-gray-600 mb-6">This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <button
                  className="px-4 py-2 rounded border"
                  onClick={() => setConfirmDeleteId(null)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-50"
                  onClick={performDelete}
                  disabled={busy}
                >
                  {busy ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Restore Modal */}
        {confirmRestore && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Restore backup?</h3>
              <p className="text-sm text-gray-600 mb-6">This will replace all current data.</p>
              <div className="flex justify-end gap-3">
                <button
                  className="px-4 py-2 rounded border"
                  onClick={() => setConfirmRestore(false)}
                >
                  Cancel
                </button>
                <label className="px-4 py-2 rounded bg-purple-600 text-white cursor-pointer">
                  Choose backup file
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => { setConfirmRestore(false); restoreBackup(e); }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
