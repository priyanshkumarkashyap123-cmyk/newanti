/**
 * Analytics Tracking Service
 *
 * Tracks user learning metrics:
 * - Time spent learning
 * - Templates completed
 * - Modules progressed
 * - Learning streaks
 * - Overall engagement
 */

export interface LearningAnalytics {
  totalTimeSpentMinutes: number;
  templatesCompleted: number;
  modulesCompleted: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string;
  firstActivityDate: string;
  averageSessionDurationMinutes: number;
  totalSessions: number;
  certificatesEarned: number;
  badgesEarned: number;
}

const ANALYTICS_STORAGE_KEY = 'beamlab_learning_analytics';

const DEFAULT_ANALYTICS: LearningAnalytics = {
  totalTimeSpentMinutes: 0,
  templatesCompleted: 0,
  modulesCompleted: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastActivityDate: new Date().toISOString(),
  firstActivityDate: new Date().toISOString(),
  averageSessionDurationMinutes: 0,
  totalSessions: 0,
  certificatesEarned: 0,
  badgesEarned: 0,
};

export function getAnalytics(): LearningAnalytics {
  if (typeof window === 'undefined') return DEFAULT_ANALYTICS;

  try {
    const stored = window.localStorage.getItem(ANALYTICS_STORAGE_KEY);
    return stored ? { ...DEFAULT_ANALYTICS, ...JSON.parse(stored) } : DEFAULT_ANALYTICS;
  } catch {
    return DEFAULT_ANALYTICS;
  }
}

export function saveAnalytics(analytics: LearningAnalytics): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(analytics));
  } catch {
    console.error('Failed to save analytics');
  }
}

export function recordSessionStart(): { startTime: number } {
  return { startTime: Date.now() };
}

export function recordSessionEnd(startTime: number, durationMinutes?: number): void {
  const analytics = getAnalytics();
  const sessionDuration = durationMinutes || Math.floor((Date.now() - startTime) / 60000);

  analytics.totalTimeSpentMinutes += sessionDuration;
  analytics.totalSessions += 1;
  analytics.averageSessionDurationMinutes =
    analytics.totalTimeSpentMinutes / analytics.totalSessions;
  analytics.lastActivityDate = new Date().toISOString();

  // Update streak
  updateStreak(analytics);

  saveAnalytics(analytics);
}

export function recordTemplateCompletion(): void {
  const analytics = getAnalytics();
  analytics.templatesCompleted += 1;
  analytics.lastActivityDate = new Date().toISOString();
  updateStreak(analytics);
  saveAnalytics(analytics);
}

export function recordModuleCompletion(): void {
  const analytics = getAnalytics();
  analytics.modulesCompleted += 1;
  analytics.lastActivityDate = new Date().toISOString();
  updateStreak(analytics);
  saveAnalytics(analytics);
}

export function recordCertificateEarned(): void {
  const analytics = getAnalytics();
  analytics.certificatesEarned += 1;
  analytics.lastActivityDate = new Date().toISOString();
  updateStreak(analytics);
  saveAnalytics(analytics);
}

export function recordBadgeEarned(): void {
  const analytics = getAnalytics();
  analytics.badgesEarned += 1;
  analytics.lastActivityDate = new Date().toISOString();
  updateStreak(analytics);
  saveAnalytics(analytics);
}

function updateStreak(analytics: LearningAnalytics): void {
  const now = new Date();
  const lastActivity = new Date(analytics.lastActivityDate);
  const daysSinceLastActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceLastActivity === 0) {
    // Same day - continue streak
    analytics.currentStreak = Math.max(1, analytics.currentStreak);
  } else if (daysSinceLastActivity === 1) {
    // Next day - increment streak
    analytics.currentStreak += 1;
    if (analytics.currentStreak > analytics.longestStreak) {
      analytics.longestStreak = analytics.currentStreak;
    }
  } else {
    // Streak broken
    if (analytics.currentStreak > analytics.longestStreak) {
      analytics.longestStreak = analytics.currentStreak;
    }
    analytics.currentStreak = 1;
  }
}

export function getAnalyticsMetrics(analytics: LearningAnalytics): {
  totalHoursSpent: number;
  totalAchievements: number;
  engagementScore: number;
  streakStatus: string;
} {
  return {
    totalHoursSpent: Math.round((analytics.totalTimeSpentMinutes / 60) * 10) / 10,
    totalAchievements: analytics.certificatesEarned + analytics.badgesEarned,
    engagementScore: Math.min(100, Math.floor((analytics.totalTimeSpentMinutes / 60) * 2 + analytics.currentStreak * 5)),
    streakStatus: `${analytics.currentStreak} day${analytics.currentStreak !== 1 ? 's' : ''} (Best: ${analytics.longestStreak})`,
  };
}

export function resetAnalytics(): void {
  saveAnalytics(DEFAULT_ANALYTICS);
}
