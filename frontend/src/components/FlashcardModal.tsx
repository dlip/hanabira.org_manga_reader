'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FlashcardManager, type Flashcard } from '@/lib/flashcards';
import { AnalyticsManager } from '@/lib/analytics';
import FuriganaText from './FuriganaText';

interface FuriganaPair {
  kanji?: string;
  reading?: string;
  text?: string;
}

interface FlashcardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText: string;
  onFlashcardSaved?: (flashcard: Flashcard) => void;
  initialBack?: string;
  initialFurigana?: FuriganaPair[];
  initialNotes?: string;
  initialGrammar?: string;
}

export default function FlashcardModal({ 
  isOpen, 
  onClose, 
  initialText,
  onFlashcardSaved,
  initialBack,
  initialFurigana,
  initialNotes,
  initialGrammar
}: FlashcardModalProps) {
  const [front, setFront] = useState(initialText);
  const [back, setBack] = useState(initialBack ?? '');
  const [reading, setReading] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [grammar, setGrammar] = useState(initialGrammar ?? '');
  const [tags, setTags] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [furigana, setFurigana] = useState<FuriganaPair[] | null>(null);
  const [showFuriganaPreview, setShowFuriganaPreview] = useState<boolean>(true);
  const [isGeneratingFurigana, setIsGeneratingFurigana] = useState<boolean>(false);
  const [showGrammarPreview, setShowGrammarPreview] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);



  useEffect(() => {
    setFront(initialText);
  }, [initialText]);

  useEffect(() => {
    if (typeof initialBack === 'string') {
      setBack(initialBack);
    }
  }, [initialBack]);

  useEffect(() => {
    if (initialFurigana) {
      setFurigana(initialFurigana);
    }
  }, [initialFurigana]);

  useEffect(() => {
    if (typeof initialNotes === 'string') {
      setNotes(initialNotes);
    }
  }, [initialNotes]);

  useEffect(() => {
    if (typeof initialGrammar === 'string') {
      setGrammar(initialGrammar);
    }
  }, [initialGrammar]);

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isOpen) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            handleImageFile(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImage(result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageFile(file);
    }
  };

  const handleSave = async () => {
    if (!front.trim() || !back.trim()) {
      alert('Please enter both front and back text for the flashcard');
      return;
    }

    setIsLoading(true);
    try {
      const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      
      const flashcard = await FlashcardManager.saveFlashcard({
        front: front.trim(),
        back: back.trim(),
        reading: reading.trim() || undefined,
        image: image || undefined,
        notes: notes.trim() || undefined,
        grammar: grammar.trim() || undefined,
        tags: tagArray.length > 0 ? tagArray : undefined,
        difficulty: difficulty,
        // furigana: furigana || undefined, // TODO: Add furigana support
      });

      // Initialize SRS data for the new card
        // SRS initialization no longer needed (backend handles new card state)
      
      // Update analytics
      AnalyticsManager.updateCurrentSession({ flashcardsCreated: 1 });

      onFlashcardSaved?.(flashcard);
      
      // Reset form
      setFront('');
      setBack('');
      setReading('');
      setImage(null);
      setNotes('');
  setGrammar('');
      setTags('');
      setDifficulty('medium');
      setFurigana(null);
      setShowFuriganaPreview(true);
      onClose();
    } catch (error) {
      console.error('Error saving flashcard:', error);
      alert('Failed to save flashcard. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const removeImage = () => {
    setImage(null);
  };

  const handleGenerateFurigana = async () => {
    if (!front.trim()) return;
    
    setIsGeneratingFurigana(true);
    
    try {
      const response = await fetch('/api/furigana', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: front.trim(),
        }),
      });
      
      const result = await response.json();
      
      if (result.success && result.furigana) {
        setFurigana(result.furigana);
      } else {
        console.error('Furigana generation failed:', result.error);
        alert('Failed to generate furigana. Please try again.');
      }
      
    } catch (error) {
      console.error('Error generating furigana:', error);
      alert('Failed to generate furigana. Please try again.');
    } finally {
      setIsGeneratingFurigana(false);
    }
  };

  if (!isOpen) return null;

  return (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Create Flashcard</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
              disabled={isLoading}
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            {/* Front (Japanese) Input */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Front (Japanese) *
              </label>
              <textarea
                value={front}
                onChange={(e) => setFront(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-lg resize-none font-japanese text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                rows={2}
                placeholder="Enter Japanese word/phrase..."
                disabled={isLoading}
              />
              
              
              {/* Generate Furigana Button */}
              {front.trim() && !furigana && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleGenerateFurigana}
                    disabled={isGeneratingFurigana}
                    className="px-3 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center"
                  >
                    {isGeneratingFurigana ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18m0 0l-4-4m4 4l4-4" />
                        </svg>
                        Generate Furigana
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Furigana Preview */}
              {furigana && furigana.length > 0 && (
                <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-semibold text-gray-900 tracking-wide">
                      Furigana Preview
                    </label>
                    <div className="flex items-center space-x-3">
                      <label className="flex items-center space-x-1 select-none">
                        <input
                          type="checkbox"
                          checked={showFuriganaPreview}
                          onChange={(e) => setShowFuriganaPreview(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-400"
                        />
                        <span className="text-xs font-medium text-gray-700">Show</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setFurigana(null)}
                        className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="text-[1.15rem] leading-[1.9] font-japanese antialiased text-gray-900">
                    <FuriganaText
                      furiganaPairs={furigana}
                      showFurigana={showFuriganaPreview}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Reading Input */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Reading (optional)
              </label>
              <input
                type="text"
                value={reading}
                onChange={(e) => setReading(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-lg font-japanese text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                placeholder="ひらがな reading..."
                disabled={isLoading}
              />
            </div>

            {/* Back (English) Input */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Back (English) *
              </label>
              <textarea
                value={back}
                onChange={(e) => setBack(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-lg resize-none text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                rows={2}
                placeholder="Enter English translation..."
                disabled={isLoading}
              />
            </div>

            {/* Image Section */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Manga Panel Image
              </label>
              
              {image ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt="Flashcard"
                    className="w-full max-h-64 object-contain border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={removeImage}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                    disabled={isLoading}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-400 rounded-lg p-8 text-center bg-white">
                  <div className="text-gray-900 mb-4">
                    <svg className="mx-auto h-12 w-12 mb-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" />
                    </svg>
                    <p className="text-lg font-medium text-gray-900">Paste image (Ctrl+V) or upload</p>
                    <p className="text-sm text-gray-800">Take a screenshot of the manga panel and paste it here</p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    disabled={isLoading}
                  >
                    Upload Image
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    aria-label="Upload image"
                    title="Upload image"
                    placeholder=""
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-lg resize-none text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                rows={2}
                placeholder="Add extra notes (optional)"
                disabled={isLoading}
              />
            </div>

            {/* Grammar Preview */}
            {grammar && grammar.trim() && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-900">
                    Grammar Explanation
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowGrammarPreview(!showGrammarPreview)}
                    className="text-sm text-blue-600 hover:text-blue-800 transition-colors flex items-center"
                  >
                    {showGrammarPreview ? (
                      <>
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        Hide
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        Show
                      </>
                    )}
                  </button>
                </div>
                
                {showGrammarPreview && (
                  <div className="max-h-64 overflow-y-auto border-2 border-blue-200 rounded-lg p-3 bg-blue-50">
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
                        {grammar}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Tags (Optional)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                placeholder="grammar, vocabulary, N3, etc. (comma-separated)"
                disabled={isLoading}
              />
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Difficulty Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDifficulty('easy')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    difficulty === 'easy'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-green-300'
                  }`}
                  disabled={isLoading}
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">Easy</div>
                    <div className="text-xs">Simple words</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDifficulty('medium')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    difficulty === 'medium'
                      ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-yellow-300'
                  }`}
                  disabled={isLoading}
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">Medium</div>
                    <div className="text-xs">Common words</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDifficulty('hard')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    difficulty === 'hard'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-red-300'
                  }`}
                  disabled={isLoading}
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">Hard</div>
                    <div className="text-xs">Complex words</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || !front.trim() || !back.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors flex items-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save Flashcard'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
