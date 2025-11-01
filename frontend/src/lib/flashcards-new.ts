// Flashcard types and interfaces
export interface Flashcard {
  id: string;
  front: string;
  back: string;
  reading?: string;
  image?: string;
  timestamp: number;
  tags?: string[];
  notes?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  text?: string; // Legacy support
}

export interface FlashcardStore {
  flashcards: Flashcard[];
  lastUpdated: number;
}

// Flashcard storage utilities
export class FlashcardManager {
  private static readonly STORAGE_KEY = 'mokuro_flashcards';

  static getFlashcards(): Flashcard[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const data: FlashcardStore = JSON.parse(stored);
      return data.flashcards || [];
    } catch (error) {
      console.error('Error loading flashcards:', error);
      return [];
    }
  }

  static saveFlashcard(flashcard: Omit<Flashcard, 'id' | 'timestamp'>): Flashcard {
    const newFlashcard: Flashcard = {
      ...flashcard,
      id: `flashcard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    const existingFlashcards = this.getFlashcards();
    const updatedFlashcards = [newFlashcard, ...existingFlashcards];

    this.saveFlashcards(updatedFlashcards);
    return newFlashcard;
  }

  private static saveFlashcards(flashcards: Flashcard[]): void {
    const data: FlashcardStore = {
      flashcards,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }
}
