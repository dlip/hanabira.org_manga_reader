// Type definitions for Mokuro Reader Enhanced API

export interface Flashcard {
  id?: number;
  front: string;
  back: string;
  reading?: string;
  meaning?: string;
  chapter_id?: string;
  page?: number;
  created_at?: string;
  updated_at?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  image_data?: string;
}

export interface Series {
  id?: number;
  title: string;
  cover_image?: string | null;
  created_at?: string;
  updated_at?: string;
  description?: string;
  author?: string;
  status?: 'reading' | 'completed' | 'on-hold' | 'dropped';
}

export interface Chapter {
  id?: string;
  series_id: string;
  title: string;
  chapter_number: number;
  file_path: string;
  created_at?: string;
  updated_at?: string;
  page_count?: number;
  added_date?: number;
}

export interface ReadingProgress {
  id?: number;
  chapter_id: string;
  current_page: number;
  total_pages?: number;
  updated_at?: string;
  reading_time?: number;
}

export interface Bookmark {
  id?: number;
  chapter_id: number;
  page_number: number;
  note?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReadingSession {
  id?: number;
  chapter_id: number;
  start_time: string;
  end_time?: string;
  pages_read?: number;
  created_at?: string;
}

export interface SRSReview {
  id?: number;
  flashcard_id: number;
  review_date: string;
  difficulty: 'again' | 'hard' | 'good' | 'easy';
  interval_days: number;
  ease_factor: number;
  created_at?: string;
}

export interface SRSStats {
  id?: number;
  flashcard_id: number;
  current_interval: number;
  current_ease_factor: number;
  next_review_date: string;
  review_count: number;
  success_rate: number;
  updated_at?: string;
}

export interface UserPreferences {
  id?: number;
  key: string;
  value: string;
  updated_at?: string;
}

export interface VocabularyHistory {
  id?: number;
  word: string;
  reading?: string;
  meaning?: string;
  chapter_id?: number;
  page?: number;
  looked_up_at?: string;
  frequency?: number;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  per_page: number;
  error?: string;
}

export interface ReadingAnalytics {
  total_reading_time: number;
  pages_read_today: number;
  current_streak: number;
  chapters_completed: number;
  average_session_length: number;
  reading_sessions: ReadingSession[];
}

export interface SRSAnalytics {
  total_cards: number;
  due_cards: number;
  mastered_cards: number;
  learning_cards: number;
  average_success_rate: number;
  reviews_today: number;
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | FormData;
  timeout?: number;
};

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';