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
  grammar?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  text?: string; // Legacy support
  furigana?: Array<{ kanji?: string; reading?: string; text?: string }>; // Furigana data structure
}

export interface FlashcardStore {
  flashcards: Flashcard[];
  lastUpdated: number;
}

import { apiClient } from './api-client';

// Flashcard storage utilities
export class FlashcardManager {
  private static readonly STORAGE_KEY = 'mokuro_flashcards';

  static async getFlashcards(): Promise<Flashcard[]> {
    try {
      const result = await apiClient.flashcards.getFlashcards();
      console.log('FlashcardManager getFlashcards result:', result);
      
      if (!Array.isArray(result)) {
        console.error('getFlashcards did not return an array:', result);
        return this.getFlashcardsFromStorage();
      }
      
      return result as unknown as Flashcard[];
    } catch (error) {
      console.error('Error loading flashcards from API:', error);
      // Fallback to localStorage for backward compatibility
      return this.getFlashcardsFromStorage();
    }
  }

  static async getFlashcard(id: string): Promise<Flashcard | null> {
    try {
      const allCards = await this.getFlashcards();
      return allCards.find(card => card.id === id) || null;
    } catch (error) {
      console.error('Error getting flashcard:', error);
      return null;
    }
  }

  static async saveFlashcard(flashcard: Omit<Flashcard, 'id' | 'timestamp'>): Promise<Flashcard> {
    const newFlashcard: Flashcard = {
      ...flashcard,
      id: `flashcard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    try {
      // Clean up the flashcard data to only include defined values
      const cleanedFlashcard: Record<string, unknown> = {
        id: newFlashcard.id,
        front: newFlashcard.front,
        back: newFlashcard.back,
        timestamp: newFlashcard.timestamp,
      };
      
      // Only add optional fields if they have values
      if (newFlashcard.reading) cleanedFlashcard.reading = newFlashcard.reading;
      if (newFlashcard.image) cleanedFlashcard.image = newFlashcard.image;
      if (newFlashcard.notes) cleanedFlashcard.notes = newFlashcard.notes;
  if (newFlashcard.grammar) cleanedFlashcard.grammar = newFlashcard.grammar;
      if (newFlashcard.tags && newFlashcard.tags.length > 0) cleanedFlashcard.tags = newFlashcard.tags;
      if (newFlashcard.difficulty) cleanedFlashcard.difficulty = newFlashcard.difficulty;
      
      const result = await apiClient.flashcards.createFlashcard(cleanedFlashcard);
      // Update the flashcard with any backend-provided data (e.g., image URL)
      if (result.image_url) {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        newFlashcard.image = `${baseUrl}${result.image_url}`;
      }
      return newFlashcard;
    } catch (error) {
      console.error('Error saving flashcard to API:', error);
      // Fallback to localStorage
      return this.saveFlashcardToStorage(flashcard);
    }
  }

  static async deleteFlashcard(cardId: string): Promise<boolean> {
    try {
      await apiClient.flashcards.deleteFlashcard(cardId);
      return true;
    } catch (error) {
      console.error('Error deleting flashcard from API:', error);
      // Fallback to localStorage
      return this.deleteFlashcardFromStorage(cardId);
    }
  }

  static async updateFlashcard(cardId: string, updates: Partial<Flashcard>): Promise<boolean> {
    try {
      // Get existing flashcard
      const existing = await apiClient.flashcards.getFlashcard(cardId);
      if (!existing) return false;

      // Create updated flashcard
      const updated = { ...existing, ...updates, timestamp: Date.now() };
      
      // Delete and recreate (since we don't have update endpoint yet)
      await apiClient.flashcards.deleteFlashcard(cardId);
      await apiClient.flashcards.createFlashcard(updated);
      return true;
    } catch (error) {
      console.error('Error updating flashcard via API:', error);
      // Fallback to localStorage
      return this.updateFlashcardInStorage(cardId, updates);
    }
  }

  // Legacy localStorage methods for backward compatibility and fallback
  private static getFlashcardsFromStorage(): Flashcard[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const data: FlashcardStore = JSON.parse(stored);
      return data.flashcards || [];
    } catch (error) {
      console.error('Error loading flashcards from storage:', error);
      return [];
    }
  }

  private static saveFlashcardToStorage(flashcard: Omit<Flashcard, 'id' | 'timestamp'>): Flashcard {
    const newFlashcard: Flashcard = {
      ...flashcard,
      id: `flashcard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    const existingFlashcards = this.getFlashcardsFromStorage();
    const updatedFlashcards = [newFlashcard, ...existingFlashcards];

    this.saveFlashcardsToStorage(updatedFlashcards);
    return newFlashcard;
  }

  private static deleteFlashcardFromStorage(cardId: string): boolean {
    const flashcards = this.getFlashcardsFromStorage();
    const initialLength = flashcards.length;
    const filtered = flashcards.filter(f => f.id !== cardId);
    
    if (filtered.length < initialLength) {
      this.saveFlashcardsToStorage(filtered);
      return true;
    }
    return false;
  }

  private static updateFlashcardInStorage(cardId: string, updates: Partial<Flashcard>): boolean {
    const flashcards = this.getFlashcardsFromStorage();
    const index = flashcards.findIndex(f => f.id === cardId);
    
    if (index >= 0) {
      flashcards[index] = { ...flashcards[index], ...updates, timestamp: Date.now() };
      this.saveFlashcardsToStorage(flashcards);
      return true;
    }
    return false;
  }

  private static saveFlashcardsToStorage(flashcards: Flashcard[]): void {
    const data: FlashcardStore = {
      flashcards,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  // Export/Import methods (kept for compatibility)
  static exportFlashcards(): string {
    const flashcards = this.getFlashcardsFromStorage(); // Use storage for export
    return JSON.stringify({ flashcards, exportDate: new Date().toISOString() }, null, 2);
  }

  static exportToAnki(): string {
    const flashcards = this.getFlashcardsFromStorage();
    const ankiDeck = {
      __type__: "Deck",
      children: [],
      crowdanki_uuid: `mokuro_deck_${Date.now()}`,
      deck_config_uuid: "default",
      deck_configurations: [],
      dyn: 0,
      extendNew: 0,
      extendRev: 0,
      media_files: [],
      name: "Mokuro Flashcards",
      note_models: [{
        __type__: "NoteModel",
        crowdanki_uuid: "mokuro_note_model",
        css: ".card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; }",
        flds: [
          { name: "Front", ord: 0, sticky: false, rtl: false, font: "Arial", size: 20 },
          { name: "Back", ord: 1, sticky: false, rtl: false, font: "Arial", size: 20 },
          { name: "Reading", ord: 2, sticky: false, rtl: false, font: "Arial", size: 16 },
          { name: "Notes", ord: 3, sticky: false, rtl: false, font: "Arial", size: 14 }
        ],
        latexPost: "\\end{document}",
        latexPre: "\\documentclass[12pt]{article}\\special{papersize=3in,5in}\\usepackage[utf8]{inputenc}\\usepackage{amssymb,amsmath}\\pagestyle{empty}\\setlength{\\parindent}{0in}\\begin{document}",
        name: "Mokuro Card",
        req: [[0, "any", [0]]],
        tags: [],
        tmpls: [{
          name: "Card 1",
          ord: 0,
          qfmt: "{{Front}}",
          afmt: "{{FrontSide}}<hr id=answer>{{Back}}<br><br><i>{{Reading}}</i><br><br>{{Notes}}"
        }],
        type: 0,
        vers: []
      }],
      notes: flashcards.map(card => ({
        __type__: "Note",
        data: "",
        fields: [
          card.front || "",
          card.back || "",
          card.reading || "",
          card.notes || ""
        ],
        flags: 0,
        guid: card.id,
        note_model_uuid: "mokuro_note_model",
        tags: card.tags || []
      }))
    };
    
    return JSON.stringify(ankiDeck, null, 2);
  }

  static exportToCSV(): string {
    const flashcards = this.getFlashcardsFromStorage();
    const headers = ['Front', 'Back', 'Reading', 'Notes', 'Tags', 'Difficulty', 'Created'];
    const csvRows = [headers.join(',')];
    
    flashcards.forEach(card => {
      const row = [
        `"${(card.front || '').replace(/"/g, '""')}"`,
        `"${(card.back || '').replace(/"/g, '""')}"`,
        `"${(card.reading || '').replace(/"/g, '""')}"`,
        `"${(card.notes || '').replace(/"/g, '""')}"`,
        `"${(card.tags || []).join('; ')}"`,
        card.difficulty || 'medium',
        new Date(card.timestamp).toISOString()
      ];
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  }

  static createBackup(): string {
    const flashcards = this.getFlashcardsFromStorage();
    return JSON.stringify({
      version: "1.0",
      exportDate: new Date().toISOString(),
      flashcards,
      totalCards: flashcards.length
    }, null, 2);
  }

  static async importFlashcards(jsonData: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonData);
      const flashcards = data.flashcards || data;
      
      if (!Array.isArray(flashcards)) {
        throw new Error('Invalid flashcard data format');
      }

      // Import to API if available, otherwise to storage
      for (const card of flashcards) {
        try {
          await this.saveFlashcard(card);
        } catch (error) {
          console.warn('Failed to import card:', card.id, error);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error importing flashcards:', error);
      return false;
    }
  }

  static async restoreBackup(jsonData: string): Promise<boolean> {
    try {
      const backup = JSON.parse(jsonData);
      
      if (!backup.flashcards || !Array.isArray(backup.flashcards)) {
        throw new Error('Invalid backup format');
      }

      // Clear existing data first (from storage, API clearing would need separate endpoint)
      localStorage.removeItem(this.STORAGE_KEY);
      
      // Restore flashcards
      return await this.importFlashcards(JSON.stringify(backup.flashcards));
    } catch (error) {
      console.error('Error restoring backup:', error);
      return false;
    }
  }
}
