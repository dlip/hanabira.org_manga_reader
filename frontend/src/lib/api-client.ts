/**
 * API client for communicating with the backend persistence layer.
 * This replaces localStorage operations with HTTP requests.
 */

import { Series, Chapter, ReadingProgress, ReadingSession, SRSReview, VocabularyHistory, SRSAnalytics } from './types';
import { Flashcard } from './flashcards';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

class ApiError extends Error {
  constructor(public message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

class BaseApiClient {
  protected baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  protected async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      if (!data.success && data.error) {
        throw new ApiError(data.error);
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Network or parsing error
      throw new ApiError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      });
    }

    return this.request<T>(url.pathname + url.search);
  }

  protected async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  protected async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  protected async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

class FlashcardApiClient extends BaseApiClient {
  async getFlashcards(): Promise<Flashcard[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await this.get<{ flashcards: any[] }>('/flashcards');
    console.log('API Response for flashcards:', response);
    
    if (!response.flashcards || !Array.isArray(response.flashcards)) {
      console.error('Invalid flashcards response:', response);
      return [];
    }
    
    // Convert relative image URLs to full URLs and map to frontend structure
    return response.flashcards.map(flashcard => ({
      id: flashcard.id,
      front: flashcard.front,
      back: flashcard.back,
      reading: flashcard.reading,
      timestamp: flashcard.timestamp,
      tags: flashcard.tags ? (typeof flashcard.tags === 'string' ? flashcard.tags.split(',').filter((t: string) => t.trim()) : flashcard.tags) : [],
      notes: flashcard.notes,
      grammar: flashcard.grammar,
      difficulty: flashcard.difficulty,
      furigana: flashcard.furigana,
      image: flashcard.image_url 
        ? `${this.baseUrl}${flashcard.image_url}`
        : undefined
    }));
  }

  async getFlashcard(cardId: string): Promise<Flashcard> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await this.get<{ flashcard: any }>(`/flashcards/${cardId}`);
    const flashcard = response.flashcard;
    return {
      id: flashcard.id,
      front: flashcard.front,
      back: flashcard.back,
      reading: flashcard.reading,
      timestamp: flashcard.timestamp,
      tags: flashcard.tags ? (typeof flashcard.tags === 'string' ? flashcard.tags.split(',').filter((t: string) => t.trim()) : flashcard.tags) : [],
      notes: flashcard.notes,
      grammar: flashcard.grammar,
      difficulty: flashcard.difficulty,
      furigana: flashcard.furigana,
      image: flashcard.image_url 
        ? `${this.baseUrl}${flashcard.image_url}`
        : undefined
    };
  }

  async createFlashcard(flashcard: Partial<Flashcard>): Promise<{ id: string; image_url?: string }> {
    return this.post<{ id: string; image_url?: string }>('/flashcards', flashcard);
  }

  async deleteFlashcard(cardId: string): Promise<void> {
    await this.delete(`/flashcards/${cardId}`);
  }
}

class SeriesApiClient extends BaseApiClient {
  async getSeries(): Promise<Series[]> {
    const response = await this.get<{ series: Series[] }>('/series');
    return response.series;
  }

  async getSeriesById(seriesId: string): Promise<Series> {
    const response = await this.get<{ series: Series }>(`/series/${seriesId}`);
    return response.series;
  }

  async createSeries(series: Partial<Series>): Promise<{ id: string }> {
    return this.post<{ id: string }>('/series', series);
  }

  async updateSeries(seriesId: string, updates: Partial<Series>): Promise<void> {
    await this.put(`/series/${seriesId}`, updates);
  }

  async deleteSeries(seriesId: string): Promise<void> {
    await this.delete(`/series/${seriesId}`);
  }
}

class ChapterApiClient extends BaseApiClient {
  async getChapters(seriesId?: string): Promise<Chapter[]> {
    const params = seriesId ? { series_id: seriesId } : undefined;
    const response = await this.get<{ chapters: Chapter[] }>('/chapters', params);
    return response.chapters;
  }

  async getChapterById(chapterId: string): Promise<Chapter> {
    const response = await this.get<{ chapter: Chapter }>(`/chapters/${chapterId}`);
    return response.chapter;
  }

  async createChapter(chapter: Partial<Chapter>): Promise<{ id: string }> {
    return this.post<{ id: string }>('/chapters', chapter);
  }

  async updateChapter(chapterId: string, updates: Partial<Chapter>): Promise<void> {
    await this.put(`/chapters/${chapterId}`, updates);
  }

  async deleteChapter(chapterId: string): Promise<void> {
    await this.delete(`/chapters/${chapterId}`);
  }
}

// Orphan chapter directory maintenance
export interface OrphanChapterDir {
  series_id: string;
  chapter_folder: string;
  rel_path: string;
  size_bytes: number;
  file_count: number;
  kind?: string; // 'chapter' | 'series'
}

class MaintenanceApiClient extends BaseApiClient {
  async listOrphanChapterDirs(): Promise<OrphanChapterDir[]> {
    const response = await this.get<{ orphans: OrphanChapterDir[] }>(`/maintenance/orphans`);
    return response.orphans || [];
  }

  async deleteOrphanChapterDir(seriesId: string, chapterFolder: string): Promise<void> {
    // Build URL correctly for both chapter and series deletions
    // For series-level deletion (empty chapterFolder), only include seriesId
    // For chapter-level deletion, include both seriesId and chapterFolder
    let url = `/maintenance/orphans/${encodeURIComponent(seriesId)}`;
    if (chapterFolder) {
      url += `/${encodeURIComponent(chapterFolder)}`;
    }
    await this.delete(url);
  }
}

class ProgressApiClient extends BaseApiClient {
  async getProgress(seriesId?: string): Promise<ReadingProgress[]> {
    const params = seriesId ? { series_id: seriesId } : undefined;
    const response = await this.get<{ progress: ReadingProgress[] }>('/progress', params);
    return response.progress;
  }

  async getChapterProgress(chapterId: string): Promise<ReadingProgress | null> {
    const response = await this.get<{ progress: ReadingProgress | null }>(`/progress/chapter/${chapterId}`);
    return response.progress;
  }

  async updateProgress(progressData: Partial<ReadingProgress>): Promise<void> {
    await this.post('/progress', progressData);
  }
}

// Backend bookmark shape (snake_case) used for raw transport (kept separate from generated Bookmark type to allow string ids)
export interface ApiBookmark {
  id?: string;
  series_id?: string;
  chapter_id?: string;
  page_number?: number;
  title?: string;
  note?: string;
  timestamp?: number;
  screenshot?: string;
}

class BookmarkApiClient extends BaseApiClient {
  async getBookmarks(seriesId?: string, chapterId?: string): Promise<ApiBookmark[]> {
    const params: Record<string, string> = {};
    if (seriesId) params.series_id = seriesId;
    if (chapterId) params.chapter_id = chapterId;
    const response = await this.get<{ bookmarks: ApiBookmark[] }>('/bookmarks', Object.keys(params).length ? params : undefined);
    return response.bookmarks;
  }

  async createBookmark(bookmark: Partial<ApiBookmark>): Promise<{ id: string }> {
    return this.post<{ id: string }>('/bookmarks', bookmark);
  }

  async deleteBookmark(bookmarkId: string): Promise<void> {
    await this.delete(`/bookmarks/${bookmarkId}`);
  }
}

class SessionApiClient extends BaseApiClient {
  async getSessions(seriesId?: string): Promise<ReadingSession[]> {
    const params = seriesId ? { series_id: seriesId } : undefined;
    const response = await this.get<{ sessions: ReadingSession[] }>('/sessions', params);
    return response.sessions;
  }

  async createSession(session: Partial<ReadingSession>): Promise<{ id: string }> {
    return this.post<{ id: string }>('/sessions', session);
  }

  async updateSession(sessionId: string, updates: Partial<ReadingSession>): Promise<void> {
    await this.put(`/sessions/${sessionId}`, updates);
  }
}

class SRSApiClient extends BaseApiClient {
  async getAllReviews(): Promise<SRSReview[]> {
    const response = await this.get<{ reviews: SRSReview[] }>('/srs/reviews');
    return response.reviews;
  }

  async getReview(cardId: string): Promise<SRSReview | null> {
    const response = await this.get<{ review: SRSReview | null }>(`/srs/reviews/${cardId}`);
    return response.review;
  }

  // Accept any shaped review payload since backend uses snake_case and richer fields than frontend SRSReview type
  // Deprecated legacy upsertReview removed (logic now centralized on backend /srs/review)

  async reviewAction(cardId: string, uiDifficulty: number): Promise<{
    card_id: string;
    interval_days: number;
    ease_factor: number;
    repetition: number;
    next_review: number;
    last_review: number;
    difficulty: number;
    streak: number;
  }> {
    const response = await this.post<{ review: {
      card_id: string;
      interval_days: number;
      ease_factor: number;
      repetition: number;
      next_review: number;
      last_review: number;
      difficulty: number;
      streak: number;
    } }>('/srs/review', { card_id: cardId, difficulty: uiDifficulty });
    return response.review;
  }

  async getCardsDue(limit: number = 20): Promise<{ id: string }[]> {
  const response = await this.get<{ cards: { card_id: string }[] }>('/srs/due', { limit: limit.toString() });
    // Transform backend SRS review records to simple card ID objects
    return response.cards.map(card => ({ id: card.card_id }));
  }

  async getStats(): Promise<SRSAnalytics> {
    const response = await this.get<{ stats: SRSAnalytics }>('/srs/stats');
    return response.stats;
  }

  async getStreak(): Promise<{ streak: number; today_has_review?: boolean }> {
    type StreakResp = { streak?: number; today_has_review?: boolean };
    const response = await this.get<StreakResp>('/srs/streak');
    return { streak: response.streak ?? 0, today_has_review: response.today_has_review };
  }

  async preview(cardId: string, difficulty: number): Promise<{
    predicted_interval_days: number;
    predicted_next_review: number;
    predicted_ease_factor: number;
    predicted_repetition: number;
    was_correct: boolean;
  }> {
    const response = await this.post<{ preview: {
      predicted_interval_days: number;
      predicted_next_review: number;
      predicted_ease_factor: number;
      predicted_repetition: number;
      was_correct: boolean;
    } }>('/srs/preview', { card_id: cardId, difficulty });
    return response.preview;
  }

  // updateStats removed – backend increments automatically during review

  // Settings endpoints removed for thin client; future: expose read-only display if backend supports custom profiles.
}

class PreferencesApiClient extends BaseApiClient {
  async getAllPreferences(): Promise<Record<string, string>> {
    const response = await this.get<{ preferences: Record<string, string> }>('/preferences');
    return response.preferences;
  }

  async getPreference(key: string): Promise<string> {
    const response = await this.get<{ value: string }>(`/preferences/${key}`);
    return response.value;
  }

  async setPreference(key: string, value: string): Promise<void> {
    await this.post('/preferences', { key, value });
  }
}

class VocabularyApiClient extends BaseApiClient {
  async getVocabulary(dateFrom?: string, dateTo?: string): Promise<VocabularyHistory[]> {
    const params: Record<string, string> = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    
    const response = await this.get<{ vocabulary: VocabularyHistory[] }>('/vocabulary', Object.keys(params).length ? params : undefined);
    return response.vocabulary;
  }

  async addVocabulary(vocabularyEntry: Partial<VocabularyHistory>): Promise<void> {
    await this.post('/vocabulary', vocabularyEntry);
  }
}

// Main API client that combines all the individual clients
export class ApiClient {
  public flashcards: FlashcardApiClient;
  public series: SeriesApiClient;
  public chapters: ChapterApiClient;
  public progress: ProgressApiClient;
  public bookmarks: BookmarkApiClient;
  public sessions: SessionApiClient;
  public srs: SRSApiClient;
  public preferences: PreferencesApiClient;
  public vocabulary: VocabularyApiClient;
  public maintenance: MaintenanceApiClient;

  constructor(baseUrl?: string) {
    this.flashcards = new FlashcardApiClient(baseUrl);
    this.series = new SeriesApiClient(baseUrl);
    this.chapters = new ChapterApiClient(baseUrl);
    this.progress = new ProgressApiClient(baseUrl);
    this.bookmarks = new BookmarkApiClient(baseUrl);
    this.sessions = new SessionApiClient(baseUrl);
    this.srs = new SRSApiClient(baseUrl);
    this.preferences = new PreferencesApiClient(baseUrl);
    this.vocabulary = new VocabularyApiClient(baseUrl);
    this.maintenance = new MaintenanceApiClient(baseUrl);
  }

  // Health check
  async healthCheck(): Promise<{ status: string; service: string }> {
    const url = `${this.flashcards['baseUrl']}/health`;
    const response = await fetch(url);
    return response.json();
  }
}

// Default API client instance
export const apiClient = new ApiClient();

// Export individual clients for direct use if needed
export {
  FlashcardApiClient,
  SeriesApiClient,
  ChapterApiClient,
  ProgressApiClient,
  BookmarkApiClient,
  SessionApiClient,
  SRSApiClient,
  PreferencesApiClient,
  VocabularyApiClient,
  ApiError
};