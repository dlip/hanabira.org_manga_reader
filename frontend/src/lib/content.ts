import { apiClient } from './api-client';
import { Series } from './types';

// Local types
export interface MangaSeries {
  id: string;
  title: string;
  author?: string;
  description?: string;
  coverImage?: string | null;
  totalChapters?: number;
  genre?: string;
  status: 'reading' | 'completed' | 'hiatus' | 'dropped' | 'ongoing';
  addedDate: number;
  lastReadDate?: number;
  path?: string;
}

export interface Chapter {
  id: string;
  seriesId: string;
  chapterNumber: number;
  title?: string;
  filePath: string; // Path to the mokuro HTML file
  pageCount?: number;
  addedDate: number;
}

export interface ReadingProgress {
  seriesId: string;
  chapterId: string;
  currentPage: number;
  totalPages: number;
  percentage: number;
  lastReadDate: number;
  isCompleted: boolean;
}

export interface Bookmark {
  id: string;
  seriesId: string;
  chapterId: string;
  pageNumber: number;
  note?: string;
  timestamp: number;
}

export interface ReadingSession {
  id: string;
  seriesId: string;
  chapterId: string;
  startTime: number;
  endTime?: number;
  pagesRead: number;
  wordsLearned: number;
  flashcardsCreated: number;
}

// Shared statistics type for series analytics
export interface SeriesStats {
  totalReadingTime: number;
  totalSessions: number;
  totalPagesRead: number;
  averageSessionTime: number;
  completionPercentage: number;
  totalBookmarks: number;
}

// Progress record map keyed by chapter ID
export type ProgressRecord = Record<string, { isCompleted?: boolean; percentage?: number } | null>;

// Transform function to convert API response to local format
const transformApiSeriesToMangaSeries = (api: Series): MangaSeries => {
  const created = api.created_at || api.updated_at || new Date().toISOString();
  return {
    id: String(api.id ?? ''),
    title: api.title,
    author: api.author,
    description: api.description,
    coverImage: api.cover_image,
    status: ((): MangaSeries['status'] => {
      if (!api.status) return 'ongoing';
      switch (api.status) {
        case 'completed': return 'completed';
        case 'on-hold': return 'hiatus';
        default: return 'ongoing';
      }
    })(),
    addedDate: new Date(created).getTime(),
    lastReadDate: api.updated_at ? new Date(api.updated_at).getTime() : undefined,
  };
};

// Transform function to convert backend chapter format to frontend format
const transformBackendChapterToFrontend = (backendChapter: import('./types').Chapter): Chapter => {
  const created = backendChapter.created_at || new Date().toISOString();
  const addedDate = backendChapter.added_date || new Date(created).getTime();
  return {
    id: backendChapter.id ?? '',
    seriesId: backendChapter.series_id,
    chapterNumber: backendChapter.chapter_number,
    title: backendChapter.title,
    filePath: backendChapter.file_path,
    pageCount: backendChapter.page_count,
    addedDate: addedDate,
  };
};

// Transform function to convert backend progress format to frontend format
const transformBackendProgressToFrontend = (backendProgress: import('./types').ReadingProgress): ReadingProgress => {
  const updated = backendProgress.updated_at || new Date().toISOString();
  return {
    seriesId: '', // We'll need to fetch this separately if needed
    chapterId: backendProgress.chapter_id, // Already a string now
    currentPage: backendProgress.current_page,
    totalPages: backendProgress.total_pages || 0,
    percentage: backendProgress.total_pages ? (backendProgress.current_page / backendProgress.total_pages) * 100 : 0,
    lastReadDate: new Date(updated).getTime(),
    isCompleted: backendProgress.total_pages ? backendProgress.current_page >= backendProgress.total_pages : false,
  };
};

export class ContentManager {
  // Series Management
  static async getSeries(): Promise<MangaSeries[]> {
    try {
      const apiSeries = await apiClient.series.getSeries();
      return apiSeries.map(transformApiSeriesToMangaSeries);
    } catch (error) {
      console.error('Error loading series from API:', error);
      return [];
    }
  }

  static async getSeriesById(id: string): Promise<MangaSeries | null> {
    try {
      const apiSeries = await apiClient.series.getSeriesById(id);
      return transformApiSeriesToMangaSeries(apiSeries);
    } catch (error) {
      console.error('Error loading series from API:', error);
      return null;
    }
  }

  static async addSeries(series: Omit<MangaSeries, 'id' | 'addedDate'>): Promise<MangaSeries> {
    try {
      // Transform to API format
      const apiPayload: Partial<Series> = {
        title: series.title,
        author: series.author,
        description: series.description,
        cover_image: series.coverImage,
        status: series.status === 'hiatus' ? 'on-hold' : (series.status as 'reading' | 'completed' | 'on-hold' | 'dropped'),
      };
      
      console.log('Creating series via API:', apiPayload);
      const response = await apiClient.series.createSeries(apiPayload);
      console.log('API response:', response);
      
      // Get the full series data after creation
      const fullSeries = await apiClient.series.getSeriesById(response.id);
      return transformApiSeriesToMangaSeries(fullSeries);
    } catch (error) {
      console.error('Error creating series via API:', error);
      throw error;
    }
  }

  static async updateSeries(id: string, updates: Partial<MangaSeries>): Promise<boolean> {
    try {
      const apiPayload: Partial<Series> = {};
      
      // Only include defined fields in the payload
      if (updates.title !== undefined) apiPayload.title = updates.title;
      if (updates.author !== undefined) apiPayload.author = updates.author;
      if (updates.description !== undefined) apiPayload.description = updates.description;
      if (updates.status !== undefined) {
        apiPayload.status = updates.status === 'hiatus' ? 'on-hold' : (updates.status as 'reading' | 'completed' | 'on-hold' | 'dropped');
      }
      
      // Handle cover_image: explicitly pass null to remove, or pass the string value
      if ('coverImage' in updates) {
        apiPayload.cover_image = updates.coverImage;
      }
      
      await apiClient.series.updateSeries(id, apiPayload);
      return true;
    } catch (error) {
      console.error('Error updating series via API:', error);
      return false;
    }
  }

  static async deleteSeries(id: string): Promise<boolean> {
    try {
      await apiClient.series.deleteSeries(id);
      return true;
    } catch (error) {
      console.error('Error deleting series from API:', error);
      return false;
    }
  }

  // Note: The following methods are stubs for future API implementation
  // Currently these would need backend API endpoints to be fully functional

  // Chapter Management - Real implementations
  static async getChapters(seriesId?: string): Promise<Chapter[]> {
    try {
      const backendChapters = await apiClient.chapters.getChapters(seriesId);
      return backendChapters.map(transformBackendChapterToFrontend);
    } catch (error) {
      console.error('Error loading chapters from API:', error);
      return [];
    }
  }

  static async getChapterById(id: string): Promise<Chapter | null> {
    try {
      const backendChapter = await apiClient.chapters.getChapterById(id);
      return transformBackendChapterToFrontend(backendChapter);
    } catch (error) {
      console.error('Error loading chapter from API:', error);
      return null;
    }
  }

  static async addChapter(chapter: Omit<Chapter, 'id' | 'addedDate'>): Promise<Chapter> {
    try {
      // Generate required fields that backend expects
      const chapterId = `chapter_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const addedDate = Date.now();
      
      // Transform to backend format with all required fields
      const backendPayload = {
        id: chapterId,
        series_id: chapter.seriesId, // Keep as string, no parsing needed
        title: chapter.title || '',
        chapter_number: chapter.chapterNumber,
        file_path: chapter.filePath,
        page_count: chapter.pageCount,
        added_date: addedDate
      };
      
      const response = await apiClient.chapters.createChapter(backendPayload);
      
      // Get the full chapter data after creation
      const fullChapter = await apiClient.chapters.getChapterById(response.id);
      return transformBackendChapterToFrontend(fullChapter);
    } catch (error) {
      console.error('Error creating chapter via API:', error);
      throw error;
    }
  }

  static async updateChapter(id: string, updates: Partial<Chapter>): Promise<boolean> {
    try {
      // Transform frontend updates to backend format
      const backendUpdates: Partial<import('./types').Chapter> = {};
      if (updates.seriesId !== undefined) backendUpdates.series_id = updates.seriesId;
      if (updates.title !== undefined) backendUpdates.title = updates.title;
      if (updates.chapterNumber !== undefined) backendUpdates.chapter_number = updates.chapterNumber;
      if (updates.filePath !== undefined) backendUpdates.file_path = updates.filePath;
      if (updates.pageCount !== undefined) backendUpdates.page_count = updates.pageCount;
      
      await apiClient.chapters.updateChapter(id, backendUpdates);
      return true;
    } catch (error) {
      console.error('Error updating chapter via API:', error);
      return false;
    }
  }

  static async deleteChapter(id: string): Promise<boolean> {
    try {
      await apiClient.chapters.deleteChapter(id);
      return true;
    } catch (error) {
      console.error('Error deleting chapter from API:', error);
      return false;
    }
  }

  // Reading Progress Management - Real implementations
  static async getProgress(seriesId?: string): Promise<ReadingProgress[]> {
    try {
      const backendProgress = await apiClient.progress.getProgress(seriesId);
      return backendProgress.map(transformBackendProgressToFrontend);
    } catch (error) {
      console.error('Error loading progress from API:', error);
      return [];
    }
  }

  static async getChapterProgress(chapterId: string): Promise<ReadingProgress | null> {
    try {
      const backendProgress = await apiClient.progress.getChapterProgress(chapterId);
      return backendProgress ? transformBackendProgressToFrontend(backendProgress) : null;
    } catch (error) {
      console.error('Error loading chapter progress from API:', error);
      return null;
    }
  }

  static async getLastReadProgress(): Promise<ReadingProgress | null> {
    // TODO: Implement backend API for progress
    console.warn('Progress API not yet implemented');
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async updateProgress(progressData: Omit<ReadingProgress, 'lastReadDate'>): Promise<ReadingProgress> {
    // TODO: Implement backend API for progress
    console.warn('Progress API not yet implemented');
    throw new Error('Progress API not yet implemented');
  }

  // Bookmark Management - Stub implementations
  static async getBookmarks(seriesId?: string, chapterId?: string): Promise<Bookmark[]> {
    try {
  // Fetch raw backend bookmarks (snake_case). Api client already returns ApiBookmark[]
  const raw = await apiClient.bookmarks.getBookmarks(seriesId, chapterId);
      return raw.map(r => ({
        id: String(r.id ?? ''),
        seriesId: String(r.series_id ?? ''),
        chapterId: String(r.chapter_id ?? ''),
        pageNumber: Number(r.page_number ?? 0),
        note: r.note || undefined,
        timestamp: Number(r.timestamp ?? Date.now()),
      }));
    } catch (error) {
      console.error('Error loading bookmarks from API:', error);
      return [];
    }
  }

  static async addBookmark(bookmark: Omit<Bookmark, 'id' | 'timestamp'>): Promise<Bookmark> {
    try {
      const newBookmark: Bookmark = {
        id: `bookmark_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        timestamp: Date.now(),
        ...bookmark,
      };
      const payload: import('./api-client').ApiBookmark = {
        id: newBookmark.id,
        series_id: newBookmark.seriesId,
        chapter_id: newBookmark.chapterId,
        page_number: newBookmark.pageNumber,
        note: newBookmark.note,
        timestamp: newBookmark.timestamp,
      };
      await apiClient.bookmarks.createBookmark(payload);
      return newBookmark;
    } catch (error) {
      console.error('Error creating bookmark via API:', error);
      throw error;
    }
  }

  static async deleteBookmark(id: string): Promise<boolean> {
    try {
      await apiClient.bookmarks.deleteBookmark(id);
      return true;
    } catch (error) {
      console.error('Error deleting bookmark via API:', error);
      return false;
    }
  }

  // Reading Session Management - Stub implementations
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async startReadingSession(seriesId: string, chapterId: string): Promise<ReadingSession> {
    // TODO: Implement backend API for reading sessions
    console.warn('Reading Session API not yet implemented');
    throw new Error('Reading Session API not yet implemented');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async endReadingSession(sessionId: string, stats: { pagesRead: number; wordsLearned: number; flashcardsCreated: number }): Promise<boolean> {
    // TODO: Implement backend API for reading sessions
    console.warn('Reading Session API not yet implemented');
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async getReadingSessions(seriesId?: string): Promise<ReadingSession[]> {
    // TODO: Implement backend API for reading sessions
    console.warn('Reading Session API not yet implemented');
    return [];
  }

  // Analytics - Stub implementations
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async getSeriesStats(seriesId: string): Promise<SeriesStats> {
    // TODO: Implement backend API for analytics
    console.warn('Analytics API not yet implemented');
    return {
      totalReadingTime: 0,
      totalSessions: 0,
      totalPagesRead: 0,
      averageSessionTime: 0,
      completionPercentage: 0,
      totalBookmarks: 0,
    };
  }

  // Import/Export - TODO: Implement as needed
  static async exportData(): Promise<string> {
    // TODO: Implement backend API for data export
    console.warn('Export API not yet implemented');
    return '{}';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async importData(jsonData: string): Promise<boolean> {
    // TODO: Implement backend API for data import
    console.warn('Import API not yet implemented');
    return false;
  }
}