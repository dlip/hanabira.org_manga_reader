'use client';

import React, { useState, useEffect } from 'react';
import { AnalyticsManager, type ReadingAnalytics } from '@/lib/analytics';
import { type ClientSRSStats, SRSManager } from '@/lib/srs';
import { 
  ChartBarIcon, 
  ArrowTrendingUpIcon,
  BookOpenIcon,
  FlagIcon,
  TrophyIcon,
  UserIcon,
  FireIcon
} from '@heroicons/react/24/outline';

interface AnalyticsDashboardProps {
  onClose: () => void;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ onClose }) => {
  const [analytics, setAnalytics] = useState<ReadingAnalytics | null>(null);
  const [srsStats, setSrsStats] = useState<ClientSRSStats | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'vocabulary' | 'progress'>('overview');

  useEffect(() => {
    loadAnalytics();

    // Live refresh when analytics update
    const onUpdated = () => {
      const analyticsData = AnalyticsManager.getAnalytics();
      setAnalytics(analyticsData);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('analytics:updated', onUpdated);
    }
    // Fallback polling to ensure UI stays in sync
    const interval = setInterval(() => {
      const analyticsData = AnalyticsManager.getAnalytics();
      setAnalytics(analyticsData);
    }, 2000);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('analytics:updated', onUpdated);
      }
      clearInterval(interval);
    };
  }, []);

  const loadAnalytics = async () => {
    const analyticsData = AnalyticsManager.getAnalytics();
    const srsData = await SRSManager.getStats();
    setAnalytics(analyticsData);
    setSrsStats(srsData);
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // removed unused getJLPTColor

  if (!analytics || !srsStats) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-center mt-4">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // Helper: map a percentage to a width class (5% steps)
  const pctToClass = (pct: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(pct / 5) * 5));
    return `w-p-${clamped}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ChartBarIcon className="w-7 h-7" />
              Reading Analytics
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          
          {/* Tabs */}
          <div className="mt-4 flex space-x-1 bg-gray-100 p-1 rounded-lg">
            {[
              { id: 'overview', label: 'Overview', icon: 'chart' },
              { id: 'vocabulary', label: 'Vocabulary', icon: 'book' },
              { id: 'progress', label: 'Progress', icon: 'flag' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'overview' | 'vocabulary' | 'progress')}
                className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.icon === 'chart' && <ArrowTrendingUpIcon className="w-4 h-4" />}
                {tab.icon === 'book' && <BookOpenIcon className="w-4 h-4" />}
                {tab.icon === 'flag' && <FlagIcon className="w-4 h-4" />}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatTime(analytics.totalReadingTime)}
                  </div>
                  <div className="text-sm text-blue-600/80">Total Reading Time</div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {analytics.currentStreak}
                  </div>
                  <div className="text-sm text-green-600/80">Day Streak</div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {analytics.vocabularyStats.totalWords}
                  </div>
                  <div className="text-sm text-purple-600/80">Words Learned</div>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {srsStats.cardsLearned}
                  </div>
                  <div className="text-sm text-orange-600/80">Cards Learned</div>
                </div>
              </div>

              {/* Enhanced Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="bg-pink-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-pink-600">
                    {analytics.totalPagesRead || 0}
                  </div>
                  <div className="text-sm text-pink-600/80">Pages Read</div>
                </div>
                
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">
                    {analytics.averageReadingVelocity?.toFixed(1) || '0.0'}
                  </div>
                  <div className="text-sm text-indigo-600/80">Pages/Min</div>
                </div>
                
                <div className="bg-cyan-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-cyan-600">
                    {(analytics.engagementScore * 100)?.toFixed(0) || '0'}%
                  </div>
                  <div className="text-sm text-cyan-600/80">Engagement</div>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {(analytics.averageFocusScore * 100)?.toFixed(0) || '0'}%
                  </div>
                  <div className="text-sm text-yellow-600/80">Focus Score</div>
                </div>
              </div>

              {/* Weekly Progress Chart */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  📅 Weekly Reading Progress
                </h3>
                <div className="space-y-3">
                  {(() => {
                    const maxWeekly = Math.max(...analytics.weeklyProgress.map(d => d.readingTime), 1);
                    return analytics.weeklyProgress.map((day) => {
                      const pct = Math.min(100, (day.readingTime / maxWeekly) * 100);
                      const pctClass = pctToClass(pct);
                      return (
                    <div key={day.date} className="flex items-center space-x-3">
                      <div className="w-16 text-sm text-gray-600">
                        {formatDate(day.date)}
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                        <div className={`bg-blue-500 h-full rounded-full transition-all duration-300 ${pctClass}`} />
                      </div>
                      <div className="w-20 text-sm text-gray-600 text-right">
                        {formatTime(day.readingTime)}
                      </div>
                      <div className="w-16 text-sm text-purple-600 text-right">
                        +{day.wordsLearned}
                      </div>
                    </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Reading Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <BookOpenIcon className="w-5 h-5" />
                    Reading Statistics
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Total Sessions</span>
                      <span className="font-semibold text-gray-900">{analytics.totalSessions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Average Session</span>
                      <span className="font-semibold text-gray-900">{formatTime(analytics.averageSessionTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Longest Session</span>
                      <span className="font-semibold text-gray-900">{formatTime(analytics.longestSession)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Longest Streak</span>
                      <span className="font-semibold text-gray-900">{analytics.longestStreak} days</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FlagIcon className="w-5 h-5" />
                    SRS Statistics
                  </h3>
                  {srsStats ? (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-700">Total Reviews</span>
                        <span className="font-semibold text-gray-900">{srsStats.totalReviews ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700">Accuracy</span>
                        <span className="font-semibold text-gray-900">{srsStats.accuracy?.toFixed(1) ?? '0.0'}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700">Mature Cards</span>
                        <span className="font-semibold text-gray-900">{srsStats.cardsMature ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700">Average Ease</span>
                        <span className="font-semibold text-gray-900">{srsStats.averageEase?.toFixed(2) ?? '2.50'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-700">Loading SRS statistics...</div>
                  )}
                </div>
              </div>

              {/* Reading Patterns and Break Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    ⏸️ Break Patterns
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Short Pauses</span>
                      <span className="font-semibold text-gray-900">{analytics.totalShortPauses || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Long Breaks</span>
                      <span className="font-semibold text-gray-900">{analytics.totalLongBreaks || 0}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Short pauses: &lt; 2 minutes<br/>
                      Long breaks: ≥ 2 minutes
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <ChartBarIcon className="w-5 h-5" />
                    Reading Quality
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Text Selections</span>
                      <span className="font-semibold text-gray-900">{analytics.totalTextSelections || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Word Lookups</span>
                      <span className="font-semibold text-gray-900">{analytics.wordsLookedUp || 0}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Higher engagement indicates active reading
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vocabulary' && (
            <div className="space-y-6">
              {/* Vocabulary Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {analytics.vocabularyStats.newWordsToday}
                  </div>
                  <div className="text-sm text-green-600/80">New Today</div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {analytics.vocabularyStats.newWordsThisWeek}
                  </div>
                  <div className="text-sm text-blue-600/80">This Week</div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {analytics.vocabularyStats.newWordsThisMonth}
                  </div>
                  <div className="text-sm text-purple-600/80">This Month</div>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {analytics.vocabularyStats.averagePerDay}
                  </div>
                  <div className="text-sm text-orange-600/80">Daily Average</div>
                </div>
              </div>

              {/* JLPT Level Distribution - Temporarily disabled until vocabulary tracking is implemented */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrophyIcon className="w-5 h-5" />
                  JLPT Level Distribution
                </h3>
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-3">🚧</div>
                  <div className="text-lg font-medium mb-2">Feature Coming Soon</div>
                  <div className="text-sm">
                    JLPT vocabulary tracking will be available in a future update.<br/>
                    Currently, word lookups don&#39;t automatically classify JLPT levels.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="space-y-6">
              {/* Achievement Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FireIcon className="w-8 h-8 text-orange-500" />
                    <div>
                      <div className="text-xl font-bold text-blue-900">
                        {analytics.currentStreak} Day Streak!
                      </div>
                      <div className="text-sm text-blue-700">
                        Keep it up! Your longest streak was {analytics.longestStreak} days.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="text-purple-600">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.168 18.477 18.582 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-purple-900">
                        {analytics.vocabularyStats.totalWords} Words Learned
                      </div>
                      <div className="text-sm text-purple-700">
                        That&apos;s {analytics.vocabularyStats.averagePerDay} words per day on average!
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Goals */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FlagIcon className="w-5 h-5" />
                  Progress Goals
                </h3>
                <div className="space-y-4">
                  {/* Reading Time Goal */}
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Daily Reading Goal (30 min)</span>
                      <span>{Math.min(100, Math.round((analytics.weeklyProgress[6]?.readingTime || 0) / 30 * 100))}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      {(() => {
                        const pct = Math.min(100, Math.round(((analytics.weeklyProgress[6]?.readingTime || 0) / 30) * 100));
                        const pctClass = pctToClass(pct);
                        return <div className={`bg-blue-500 h-full rounded-full transition-all duration-300 ${pctClass}`} />;
                      })()}
                    </div>
                  </div>

                  {/* Weekly Vocabulary Goal */}
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Weekly Vocabulary Goal (50 words)</span>
                      <span>{Math.min(100, Math.round(analytics.vocabularyStats.newWordsThisWeek / 50 * 100))}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      {(() => {
                        const pct = Math.min(100, Math.round((analytics.vocabularyStats.newWordsThisWeek / 50) * 100));
                        const pctClass = pctToClass(pct);
                        return <div className={`bg-green-500 h-full rounded-full transition-all duration-300 ${pctClass}`} />;
                      })()}
                    </div>
                  </div>

                  {/* SRS Accuracy Goal */}
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>SRS Accuracy Goal (85%)</span>
                      <span>{Math.min(100, Math.round((srsStats.accuracy ?? 0) / 85 * 100))}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      {(() => {
                        const pct = Math.min(100, Math.round(((srsStats.accuracy ?? 0) / 85) * 100));
                        const pctClass = pctToClass(pct);
                        return <div className={`bg-purple-500 h-full rounded-full transition-all duration-300 ${pctClass}`} />;
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Milestones */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrophyIcon className="w-5 h-5" />
                  Milestones
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      title: "First Steps",
                      description: "Read for 1 hour total",
                      progress: Math.min(100, (analytics.totalReadingTime / 60) * 100),
                      completed: analytics.totalReadingTime >= 60,
                      icon: "user"
                    },
                    {
                      title: "Vocabulary Builder",
                      description: "Learn 100 words",
                      progress: Math.min(100, (analytics.vocabularyStats.totalWords / 100) * 100),
                      completed: analytics.vocabularyStats.totalWords >= 100,
                      icon: "book"
                    },
                    {
                      title: "Consistency Master",
                      description: "7-day reading streak",
                      progress: Math.min(100, (analytics.currentStreak / 7) * 100),
                      completed: analytics.currentStreak >= 7,
                      icon: "flag"
                    }
                  ].map((milestone, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-2 ${
                        milestone.completed 
                          ? 'border-green-200 bg-green-50' 
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-8 h-8 flex items-center justify-center">
                          {milestone.icon === 'user' && <UserIcon className="w-6 h-6 text-gray-700" />}
                          {milestone.icon === 'book' && <BookOpenIcon className="w-6 h-6 text-gray-700" />}
                          {milestone.icon === 'flag' && <FlagIcon className="w-6 h-6 text-gray-700" />}
                        </div>
                        <div className="font-semibold text-gray-900">
                          {milestone.title}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        {milestone.description}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        {(() => {
                          const pctClass = pctToClass(milestone.progress);
                          return (
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                milestone.completed ? 'bg-green-500' : 'bg-blue-500'
                              } ${pctClass}`}
                            />
                          );
                        })()}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {milestone.progress.toFixed(0)}% complete
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
