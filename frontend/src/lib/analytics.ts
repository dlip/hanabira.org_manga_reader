// Reading analytics and progress tracking
export interface ReadingSession {
  id: string;
  startTime: number;
  endTime: number;
  duration: number; // in minutes (active time only)
  totalPausedTime: number; // in minutes (time paused/inactive)
  charactersRead: number;
  wordsLookedUp: number;
  flashcardsCreated: number;
  date: string; // YYYY-MM-DD format
  lastActivityTime?: number; // for tracking active time
  isPaused?: boolean; // current state
  pauseStartTime?: number; // when current pause started
  // Enhanced metrics
  pagesRead?: number; // for reading velocity
  textSelections?: number; // engagement metric
  shortPauses?: number; // pauses < 2 minutes
  longBreaks?: number; // pauses >= 2 minutes
  focusScore?: number; // 0-100 based on engagement quality
}

export interface VocabularyStats {
  totalWords: number;
  newWordsToday: number;
  newWordsThisWeek: number;
  newWordsThisMonth: number;
  averagePerDay: number;
  jlptN5: number;
  jlptN4: number;
  jlptN3: number;
  jlptN2: number;
  jlptN1: number;
  unknown: number;
}

export interface ReadingAnalytics {
  totalReadingTime: number; // in minutes
  totalSessions: number;
  averageSessionTime: number;
  longestSession: number;
  currentStreak: number;
  longestStreak: number;
  charactersRead: number;
  wordsLookedUp: number;
  flashcardsCreated: number;
  vocabularyStats: VocabularyStats;
  weeklyProgress: Array<{
    date: string;
    readingTime: number;
    wordsLearned: number;
  }>;
  // Enhanced metrics
  totalPagesRead: number;
  totalTextSelections: number; // total text selections made
  averageReadingVelocity: number; // pages per active minute
  engagementScore: number; // 0-100 based on selections/lookups per minute
  averageFocusScore: number; // 0-100 based on break patterns
  totalShortPauses: number;
  totalLongBreaks: number;
}

export class AnalyticsManager {
  private static readonly SESSIONS_KEY = 'mokuro_reading_sessions';
  private static readonly CURRENT_SESSION_KEY = 'mokuro_current_session';
  private static readonly VOCABULARY_KEY = 'mokuro_vocabulary_history';

  // Notify listeners (e.g., dashboard) that analytics have updated
  private static notifyUpdated(): void {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('analytics:updated'));
      }
    } catch {}
  }

  static startReadingSession(): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const session = {
      id: sessionId,
      startTime: now,
      lastActivityTime: now,
      charactersRead: 0,
      wordsLookedUp: 0,
      flashcardsCreated: 0,
      totalPausedTime: 0,
      isPaused: false,
      // Enhanced metrics
      pagesRead: 0,
      textSelections: 0,
      shortPauses: 0,
      longBreaks: 0,
      focusScore: 1.0 // Start with perfect focus (1.0 = 100%)
    };

    localStorage.setItem(this.CURRENT_SESSION_KEY, JSON.stringify(session));
    this.notifyUpdated();
    return sessionId;
  }

  static endReadingSession(): ReadingSession | null {
    try {
      const currentSessionData = localStorage.getItem(this.CURRENT_SESSION_KEY);
      if (!currentSessionData) return null;

      const session = JSON.parse(currentSessionData);
      const endTime = Date.now();
      
      // If session is currently paused, add the current pause time
      let totalPausedTime = session.totalPausedTime || 0;
      if (session.isPaused && session.pauseStartTime) {
        totalPausedTime += Math.round((endTime - session.pauseStartTime) / (1000 * 60));
      }

      // Calculate active duration (total time minus paused time)
      const totalDuration = Math.round((endTime - session.startTime) / (1000 * 60));
      const activeDuration = Math.max(0, totalDuration - totalPausedTime);

      const completedSession: ReadingSession = {
        ...session,
        endTime,
        duration: activeDuration, // Only active time
        totalPausedTime,
        date: new Date().toISOString().split('T')[0]
      };

      // Save completed session
      this.saveSession(completedSession);

      // Clear current session
      localStorage.removeItem(this.CURRENT_SESSION_KEY);

      this.notifyUpdated();

      return completedSession;
    } catch (_error) {
      console.error('Error ending reading session:', _error);
      return null;
    }
  }



  static updateCurrentSession(updates: Partial<{
    charactersRead: number;
    wordsLookedUp: number;
    flashcardsCreated: number;
  }>): void {
    try {
      const currentSessionData = localStorage.getItem(this.CURRENT_SESSION_KEY);
      if (!currentSessionData) return;

      const session = JSON.parse(currentSessionData);
      
      // Increment values instead of replacing them
      const updatedSession = {
        ...session,
        charactersRead: (session.charactersRead || 0) + (updates.charactersRead || 0),
        wordsLookedUp: (session.wordsLookedUp || 0) + (updates.wordsLookedUp || 0),
        flashcardsCreated: (session.flashcardsCreated || 0) + (updates.flashcardsCreated || 0)
      };

      localStorage.setItem(this.CURRENT_SESSION_KEY, JSON.stringify(updatedSession));
    } catch (error) {
      console.error('Error updating current session:', error);
    }
  }

  static getCurrentSession(): ReadingSession | null {
    try {
      const currentSessionData = localStorage.getItem(this.CURRENT_SESSION_KEY);
      return currentSessionData ? JSON.parse(currentSessionData) : null;
  } catch (error) {
    console.error('Error getting current session:', error);
    return null;
    }
  }

  // Activity-based tracking methods
  static pauseCurrentSession(): void {
    try {
      const session = this.getCurrentSession();
      if (!session || session.isPaused) return;

      session.isPaused = true;
      session.pauseStartTime = Date.now();
      localStorage.setItem(this.CURRENT_SESSION_KEY, JSON.stringify(session));
    } catch (_error) {
      console.error('Error pausing session:', _error);
    }
  }

  static resumeCurrentSession(): void {
    try {
      const session = this.getCurrentSession();
      if (!session || !session.isPaused) return;

      const now = Date.now();
      
      // Add pause duration to total paused time and categorize break type
      if (session.pauseStartTime) {
        const pauseDuration = Math.round((now - session.pauseStartTime) / (1000 * 60));
        session.totalPausedTime = (session.totalPausedTime || 0) + pauseDuration;
        
        // Smart break detection: < 2 minutes = short pause, >= 2 minutes = long break
        if (pauseDuration < 2) {
          session.shortPauses = (session.shortPauses || 0) + 1;
        } else {
          session.longBreaks = (session.longBreaks || 0) + 1;
          // Long breaks slightly reduce focus score (max reduction to 0.7 = 70%)
          session.focusScore = Math.max(0.7, (session.focusScore || 1.0) - 0.05);
        }
      }

      session.isPaused = false;
      session.lastActivityTime = now;
      delete session.pauseStartTime;
      
      localStorage.setItem(this.CURRENT_SESSION_KEY, JSON.stringify(session));
    } catch (_error) {
      console.error('Error resuming session:', _error);
    }
  }

  static recordActivity(): void {
    try {
      const session = this.getCurrentSession();
      if (!session) return;

      const now = Date.now();
      session.lastActivityTime = now;

      // If session was paused, resume it
      if (session.isPaused) {
        this.resumeCurrentSession();
      } else {
        localStorage.setItem(this.CURRENT_SESSION_KEY, JSON.stringify(session));
      }
    } catch (_error) {
      console.error('Error recording activity:', _error);
    }
  }

  static checkForIdleTimeout(idleTimeoutMs: number = 5 * 60 * 1000): void {
    try {
      const session = this.getCurrentSession();
      if (!session || session.isPaused) return;

      const now = Date.now();
      const lastActivity = session.lastActivityTime || session.startTime;
      const timeSinceActivity = now - lastActivity;

      if (timeSinceActivity > idleTimeoutMs) {
        this.pauseCurrentSession();
      }
    } catch (_error) {
      console.error('Error checking idle timeout:', _error);
    }
  }

  // Enhanced tracking methods
  static recordPageTurn(): void {
    try {
      const session = this.getCurrentSession();
      if (!session || session.isPaused) return;

      session.pagesRead = (session.pagesRead || 0) + 1;
      // Persist immediately, then record general activity
      localStorage.setItem(this.CURRENT_SESSION_KEY, JSON.stringify(session));
      this.recordActivity();
      this.notifyUpdated();
    } catch (_error) {
      console.error('Error recording page turn:', _error);
    }
  }

  static recordTextSelection(): void {
    try {
      const session = this.getCurrentSession();
      if (!session || session.isPaused) return;

      session.textSelections = (session.textSelections || 0) + 1;
      localStorage.setItem(this.CURRENT_SESSION_KEY, JSON.stringify(session));
      this.recordActivity();
      this.notifyUpdated();
    } catch (_error) {
      console.error('Error recording text selection:', _error);
    }
  }

  static recordWordLookup(): void {
    try {
      const session = this.getCurrentSession();
      if (!session || session.isPaused) return;

      session.wordsLookedUp = (session.wordsLookedUp || 0) + 1;
      localStorage.setItem(this.CURRENT_SESSION_KEY, JSON.stringify(session));
      this.recordActivity();
      this.notifyUpdated();
    } catch (_error) {
      console.error('Error recording word lookup:', _error);
    }
  }

  static getAllSessions(): ReadingSession[] {
    try {
      const stored = localStorage.getItem(this.SESSIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (_error) {
      console.error('Error loading reading sessions:', _error);
      return [];
    }
  }

  static getAnalytics(): ReadingAnalytics {
    const sessions = this.getAllSessions();
    const currentSession = this.getCurrentSession();
    
    // Include current active session in analytics if it exists
    const allSessions = currentSession ? [...sessions, currentSession] : sessions;
    const vocabularyHistory = this.getVocabularyHistory();

    if (allSessions.length === 0) {
      return {
        totalReadingTime: 0,
        totalSessions: 0,
        averageSessionTime: 0,
        longestSession: 0,
        currentStreak: 0,
        longestStreak: 0,
        charactersRead: 0,
        wordsLookedUp: 0,
        flashcardsCreated: 0,
        vocabularyStats: {
          totalWords: 0,
          newWordsToday: 0,
          newWordsThisWeek: 0,
          newWordsThisMonth: 0,
          averagePerDay: 0,
          jlptN5: 0,
          jlptN4: 0,
          jlptN3: 0,
          jlptN2: 0,
          jlptN1: 0,
          unknown: 0
        },
        weeklyProgress: [],
        // Enhanced metrics
        totalPagesRead: 0,
        totalTextSelections: 0,
        averageReadingVelocity: 0,
        engagementScore: 0,
        averageFocusScore: 1.0,
        totalShortPauses: 0,
        totalLongBreaks: 0
      };
    }

    const totalReadingTime = allSessions.reduce((sum, session) => sum + (session.duration || 0), 0);
    const totalSessions = allSessions.length;
    const averageSessionTime = totalSessions > 0 ? Math.round(totalReadingTime / totalSessions) : 0;
    const longestSession = allSessions.length > 0 ? Math.max(...allSessions.map(session => session.duration || 0)) : 0;
    
    const streaks = this.calculateStreaks(sessions); // Use completed sessions only for streaks
    const charactersRead = allSessions.reduce((sum, session) => sum + (session.charactersRead || 0), 0);
    const wordsLookedUp = allSessions.reduce((sum, session) => sum + (session.wordsLookedUp || 0), 0);
    const flashcardsCreated = allSessions.reduce((sum, session) => sum + (session.flashcardsCreated || 0), 0);

    const vocabularyStats = this.calculateVocabularyStats(vocabularyHistory);
    const weeklyProgress = this.calculateWeeklyProgress(sessions); // Use completed sessions for weekly progress

    // Calculate enhanced metrics
    const totalPagesRead = allSessions.reduce((sum, session) => sum + (session.pagesRead || 0), 0);
    const totalTextSelections = allSessions.reduce((sum, session) => sum + (session.textSelections || 0), 0);
    const totalShortPauses = allSessions.reduce((sum, session) => sum + (session.shortPauses || 0), 0);
    const totalLongBreaks = allSessions.reduce((sum, session) => sum + (session.longBreaks || 0), 0);
    

    
    // Reading velocity: pages per active minute
    const averageReadingVelocity = totalReadingTime > 0 ? Math.round((totalPagesRead / totalReadingTime) * 100) / 100 : 0;
    
    // Engagement score: (selections + lookups) per active minute, capped at 100
    const totalEngagementActions = totalTextSelections + wordsLookedUp;
    const engagementScore = totalReadingTime > 0 
      ? Math.min(100, Math.round((totalEngagementActions / totalReadingTime) * 10 * 100) / 100)
      : 0;
    
    // Average focus score from all sessions (normalize to decimal between 0 and 1)
    const focusScores = allSessions.map(s => {
      let score = s.focusScore || 1.0;
      // Normalize old integer format (70-100) to decimal format (0.7-1.0)
      if (score > 1) {
        score = score / 100;
      }
      return score;
    }).filter(score => score > 0);
    const averageFocusScore = focusScores.length > 0 
      ? focusScores.reduce((sum, score) => sum + score, 0) / focusScores.length
      : 1.0;

    return {
      totalReadingTime,
      totalSessions,
      averageSessionTime,
      longestSession,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
      charactersRead,
      wordsLookedUp,
      flashcardsCreated,
      vocabularyStats,
      weeklyProgress,
      // Enhanced metrics
      totalPagesRead,
      totalTextSelections,
      averageReadingVelocity,
      engagementScore,
      averageFocusScore,
      totalShortPauses,
      totalLongBreaks
    };
  }

  private static saveSession(session: ReadingSession): void {
    try {
      const sessions = this.getAllSessions();
      sessions.push(session);
      
      // Keep only last 365 days of sessions
      const cutoffDate = Date.now() - (365 * 24 * 60 * 60 * 1000);
      const filteredSessions = sessions.filter(s => s.startTime > cutoffDate);
      
      localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(filteredSessions));
    } catch (_error) {
      console.error('Error saving reading session:', _error);
    }
  }

  private static getVocabularyHistory(): Record<string, Array<{word: string; jlptLevel: string; timestamp: number}>> {
    try {
      const stored = localStorage.getItem(this.VOCABULARY_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private static calculateStreaks(sessions: ReadingSession[]): { current: number; longest: number } {
    if (sessions.length === 0) return { current: 0, longest: 0 };

    // Group sessions by date
    const sessionsByDate = sessions.reduce((acc, session) => {
      const date = session.date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(session);
      return acc;
    }, {} as Record<string, ReadingSession[]>);

    const dates = Object.keys(sessionsByDate).sort();
    if (dates.length === 0) return { current: 0, longest: 0 };

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Calculate longest streak by finding consecutive date sequences
    let longestStreak = 1;
    let tempStreak = 1;

    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currentDate = new Date(dates[i]);
      const daysDiff = Math.round((currentDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000));

      if (daysDiff === 1) {
        // Consecutive day
        tempStreak++;
      } else {
        // Streak broken
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    // Calculate current streak working backwards from today
    let currentStreak = 0;
    
    if (dates.includes(today)) {
      // Current streak includes today
      currentStreak = 1;
      const todayIndex = dates.indexOf(today);
      
      for (let i = todayIndex - 1; i >= 0; i--) {
        const currentDate = new Date(dates[i + 1]);
        const prevDate = new Date(dates[i]);
        const daysDiff = Math.round((currentDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000));
        
        if (daysDiff === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    } else if (dates.includes(yesterday)) {
      // Current streak ended yesterday (still considered current)
      currentStreak = 1;
      const yesterdayIndex = dates.indexOf(yesterday);
      
      for (let i = yesterdayIndex - 1; i >= 0; i--) {
        const currentDate = new Date(dates[i + 1]);
        const prevDate = new Date(dates[i]);
        const daysDiff = Math.round((currentDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000));
        
        if (daysDiff === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    return { current: currentStreak, longest: Math.max(longestStreak, currentStreak) };
  }

  private static calculateVocabularyStats(history: Record<string, Array<{word: string; jlptLevel: string; timestamp: number}>>): VocabularyStats {
    const today = new Date().toISOString().split('T')[0];
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let totalWords = 0;
    let newWordsToday = 0;
    let newWordsThisWeek = 0;
    let newWordsThisMonth = 0;
    const jlptCounts = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0, unknown: 0 };

    Object.entries(history).forEach(([date, words]) => {
      totalWords += words.length;

      if (date === today) {
        newWordsToday = words.length;
      }

      if (date >= oneWeekAgo) {
        newWordsThisWeek += words.length;
      }

      if (date >= oneMonthAgo) {
        newWordsThisMonth += words.length;
      }

      words.forEach(word => {
        const level = word.jlptLevel.toUpperCase();
        if (level in jlptCounts) {
          jlptCounts[level as keyof typeof jlptCounts]++;
        } else {
          jlptCounts.unknown++;
        }
      });
    });

    const daysWithData = Object.keys(history).length;
    const averagePerDay = daysWithData > 0 ? Math.round(totalWords / daysWithData) : 0;

    return {
      totalWords,
      newWordsToday,
      newWordsThisWeek,
      newWordsThisMonth,
      averagePerDay,
      jlptN5: jlptCounts.N5,
      jlptN4: jlptCounts.N4,
      jlptN3: jlptCounts.N3,
      jlptN2: jlptCounts.N2,
      jlptN1: jlptCounts.N1,
      unknown: jlptCounts.unknown
    };
  }

  private static calculateWeeklyProgress(sessions: ReadingSession[]): Array<{date: string; readingTime: number; wordsLearned: number}> {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      last7Days.push(date);
    }

    const vocabularyHistory = this.getVocabularyHistory();

    return last7Days.map(date => {
      const daySessions = sessions.filter(session => session.date === date);
      const readingTime = daySessions.reduce((sum, session) => sum + session.duration, 0);
      const wordsLearned = vocabularyHistory[date] ? vocabularyHistory[date].length : 0;

      return { date, readingTime, wordsLearned };
    });
  }
}
