'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { SRSManager } from '@/lib/srs';
import { FlashcardManager, type Flashcard } from '@/lib/flashcards';

interface SRSReviewProps {
  onClose: () => void;
  onComplete: (reviewsCompleted: number) => void;
}

const SRSReview: React.FC<SRSReviewProps> = ({ onClose, onComplete }) => {
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentCard, setCurrentCard] = useState<Flashcard | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewsCompleted, setReviewsCompleted] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [previewMap, setPreviewMap] = useState<Record<number, { days: number }>>({});
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    loadReviewQueue();
  }, []);

  useEffect(() => {
    const loadCurrentCard = async () => {
      if (reviewQueue.length > 0 && currentIndex < reviewQueue.length) {
        const cardId = reviewQueue[currentIndex];
        const card = await FlashcardManager.getFlashcard(cardId);
        if (!card) {
          // Skip missing/invalid card IDs
          const nextIdx = currentIndex + 1;
          if (nextIdx < reviewQueue.length) {
            setCurrentIndex(nextIdx);
          } else {
            setCurrentCard(null);
          }
          return;
        }
        setCurrentCard(card);
        setShowAnswer(false);
      } else {
        setCurrentCard(null);
      }
    };
    
    loadCurrentCard();
  }, [reviewQueue, currentIndex]);

  const loadReviewQueue = async () => {
    setIsLoading(true);
    try {
      const candidates = await SRSManager.getCardsForReview(20);
      // Validate that flashcards exist for these IDs
      const validationPromises = candidates.map(async (id) => {
        const card = await FlashcardManager.getFlashcard(id);
        return card ? id : null;
      });
      const validationResults = await Promise.all(validationPromises);
  const valid = validationResults.filter((id): id is string => id !== null);

      // Removed previous fallback that injected the first N flashcards when none were due.
      // We now strictly respect the backend authoritative due list to avoid "phantom" reviews.

      setReviewQueue(valid);
      setCurrentIndex(0);
    } catch (e) {
      console.error('Failed to load review queue:', e);
      setReviewQueue([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDifficultySelect = async (difficulty: number) => {
    if (!currentCard) return;

    // Update SRS data
    await SRSManager.reviewCard(currentCard.id, difficulty);

    setReviewsCompleted((prev) => prev + 1);
    // Optimistically remove this card from the local queue if it's no longer due locally
  const updatedQueue = [...reviewQueue];
  // Always remove reviewed card optimistically; backend will keep it due if needed
    updatedQueue.splice(currentIndex, 1);

    if (updatedQueue.length === 0) {
      setReviewQueue([]);
      onComplete(reviewsCompleted + 1);
      return;
    }

    // Advance index (stay at same index if we removed current card)
    if (updatedQueue.length > 0) {
      let nextIndex = currentIndex;
      if (currentIndex >= updatedQueue.length) {
        nextIndex = 0; // safety fallback
      }
      setReviewQueue(updatedQueue);
      setCurrentIndex(nextIndex);
    }
  };

  const refreshPreviews = useCallback(async () => {
    if (!currentCard) return;
    setIsPreviewing(true);
    const next: Record<number, { days: number }> = {};
    for (const d of [1,2,3,4]) {
      try {
        const p = await SRSManager.preview(currentCard.id, d);
        if (p) next[d] = { days: p.predicted_interval_days };
      } catch {/* ignore */}
    }
    setPreviewMap(next);
    setIsPreviewing(false);
  }, [currentCard]);

  // Refresh previews when answer is shown or card changes
  useEffect(() => { void refreshPreviews(); }, [refreshPreviews, showAnswer]);

  const getDifficultyColor = (difficulty: number): string => {
    switch (difficulty) {
      case 1: return 'bg-green-500 hover:bg-green-600 text-white';
      case 2: return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 3: return 'bg-yellow-500 hover:bg-yellow-600 text-white';
      case 4: return 'bg-orange-500 hover:bg-orange-600 text-white';
      default: return 'bg-gray-500 hover:bg-gray-600 text-white';
    }
  };

  const getDifficultyLabel = (difficulty: number): string => {
    switch (difficulty) {
      case 1: return 'Again';
      case 2: return 'Hard';
      case 3: return 'Good';
      case 4: return 'Easy';
      default: return 'Unknown';
    }
  };

  // Preview the next interval label using current SRS state and chosen difficulty

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-center mt-4">Loading review session...</p>
        </div>
      </div>
    );
  }

  if (reviewQueue.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md mx-4">
          <div className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              All caught up!
            </h2>
            <p className="text-gray-600 mb-6">
              No cards are due for review right now. Come back later or create more flashcards!
            </p>
            <button
              onClick={onClose}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <p className="text-center">Error loading card...</p>
          <button
            onClick={onClose}
            className="mt-4 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const total = Math.max(1, reviewQueue.length);
  const progress = ((currentIndex + 1) / total) * 100;
  // Discrete width classes (0%,5%,...,100%) so we avoid inline styles
  const widthClasses = [
    'w-[0%]','w-[5%]','w-[10%]','w-[15%]','w-[20%]','w-[25%]','w-[30%]','w-[35%]','w-[40%]','w-[45%]',
    'w-[50%]','w-[55%]','w-[60%]','w-[65%]','w-[70%]','w-[75%]','w-[80%]','w-[85%]','w-[90%]','w-[95%]','w-[100%]'
  ];
  const widthIndex = Math.min(20, Math.max(0, Math.round(progress / 5)));
  const widthClass = widthClasses[widthIndex];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              SRS Review Session
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="mb-2">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Progress</span>
              <span>{currentIndex + 1} / {total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className={`bg-blue-500 h-2 rounded-full transition-all duration-300 ${widthClass}`} />
            </div>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="text-3xl font-bold text-gray-900 mb-2 font-japanese">
              {currentCard.front || currentCard.text}
            </div>
            {currentCard.reading && (
              <div className="text-lg text-gray-600 mb-2 font-japanese">
                {currentCard.reading}
              </div>
            )}
          </div>

          {currentCard.image && (
            <div className="mb-6 flex justify-center">
              <Image
                src={currentCard.image}
                alt="Flashcard context"
                width={512}
                height={512}
                className="max-w-full max-h-64 object-contain rounded-lg shadow-md h-auto w-auto"
                unoptimized
              />
            </div>
          )}

          {!showAnswer ? (
            <div className="text-center">
              <button
                onClick={() => setShowAnswer(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-medium text-lg"
              >
                Show Answer
              </button>
            </div>
          ) : (
            <div>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="text-lg text-gray-900 font-medium mb-2">
                  {currentCard.back || 'No translation available'}
                </div>
                {currentCard.notes && (
                  <div className="text-sm text-gray-600">
                    {currentCard.notes}
                  </div>
                )}
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  How well did you know this card?
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((difficulty) => {
                    const preview = previewMap[difficulty];
                    return (
                      <button
                        key={difficulty}
                        onClick={() => handleDifficultySelect(difficulty)}
                        className={`p-3 rounded-lg font-medium transition-colors relative ${getDifficultyColor(difficulty)}`}
                        disabled={isPreviewing && !preview}
                      >
                        <div className="font-semibold">{getDifficultyLabel(difficulty)}</div>
                        <div className="text-xs opacity-90 mt-1">
                          {preview ? `${preview.days}d` : (isPreviewing ? '…' : '')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SRSReview;
