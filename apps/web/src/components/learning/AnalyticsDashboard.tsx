/**
 * Analytics Dashboard Component
 *
 * Displays comprehensive learning analytics and engagement metrics
 */

import { TrendingUp, Zap, Target, Flame, BookOpen, Award } from 'lucide-react';
import {
  getAnalytics,
  getAnalyticsMetrics,
  type LearningAnalytics,
} from '@/services/learning/analyticsTracker';

export function AnalyticsDashboard() {
  const analytics = getAnalytics();
  const metrics = getAnalyticsMetrics(analytics);

  return (
    <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          Your Learning Analytics
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Track your progress and engagement across the learning platform
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* Time Spent */}
        <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 dark:border-blue-900 dark:from-blue-950 dark:to-cyan-950">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Total Time Spent</p>
              <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                {metrics.totalHoursSpent}h
              </p>
            </div>
            <Clock className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        {/* Templates Completed */}
        <div className="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-4 dark:border-purple-900 dark:from-purple-950 dark:to-pink-950">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Templates Completed</p>
              <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                {analytics.templatesCompleted}
              </p>
            </div>
            <BookOpen className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        {/* Achievements */}
        <div className="rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 dark:border-amber-900 dark:from-amber-950 dark:to-orange-950">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Achievements</p>
              <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                {metrics.totalAchievements}
              </p>
            </div>
            <Award className="w-8 h-8 text-amber-500" />
          </div>
        </div>

        {/* Engagement Score */}
        <div className="rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4 dark:border-green-900 dark:from-green-950 dark:to-emerald-950">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Engagement Score</p>
              <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                {metrics.engagementScore}/100
              </p>
            </div>
            <Zap className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Streak & Details */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Current Streak */}
        <div className="rounded-lg border border-red-200 bg-gradient-to-br from-red-50 to-pink-50 p-5 dark:border-red-900 dark:from-red-950 dark:to-pink-950">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Learning Streak</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{metrics.streakStatus}</p>
              <div className="mt-3">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  {analytics.currentStreak > 0 ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white text-sm font-bold">
                        {analytics.currentStreak}
                      </span>
                      Keep it up! Your longest streak is {analytics.longestStreak} days.
                    </span>
                  ) : (
                    'Start your first learning session today!'
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Learning Summary */}
        <div className="rounded-lg border border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 p-5 dark:border-gray-700 dark:from-gray-800 dark:to-gray-900">
          <div className="flex items-start justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              Learning Summary
            </h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Modules Completed:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{analytics.modulesCompleted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Certificates:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{analytics.certificatesEarned}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Badges Earned:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{analytics.badgesEarned}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Sessions:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{analytics.totalSessions}</span>
            </div>
            <div className="flex justify-between border-t border-gray-300 pt-3 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Avg. Session:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {Math.round(analytics.averageSessionDurationMinutes)}m
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="mt-6 rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 p-5 dark:border-purple-900 dark:from-purple-950 dark:to-pink-950">
        <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Insights & Tips</h3>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {getInsights(analytics).map((insight, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 font-bold">•</span>
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function getInsights(analytics: LearningAnalytics): string[] {
  const insights: string[] = [];

  if (analytics.templatesCompleted === 0) {
    insights.push('Start your first template to begin earning achievements!');
  } else if (analytics.templatesCompleted < 5) {
    insights.push(`Complete ${5 - analytics.templatesCompleted} more templates to unlock "Template Explorer" badge.`);
  } else if (analytics.templatesCompleted < 10) {
    insights.push(`Complete ${10 - analytics.templatesCompleted} more templates to unlock "Expert Explorer" milestone!`);
  } else {
    insights.push('🎉 You\'ve unlocked all template-based milestones! Keep exploring advanced content.');
  }

  if (analytics.currentStreak === 0) {
    insights.push('Build a learning streak by practicing consistently each day.');
  } else if (analytics.currentStreak >= 7) {
    insights.push(`Impressive ${analytics.currentStreak}-day streak! You're a learning champion.`);
  } else {
    insights.push(`Keep your ${analytics.currentStreak}-day streak alive by practicing tomorrow!`);
  }

  if (analytics.averageSessionDurationMinutes < 15) {
    insights.push('Try to increase session duration - aim for at least 30 minutes for better retention.');
  } else if (analytics.averageSessionDurationMinutes >= 45) {
    insights.push('Excellent session duration! You\'re dedicating focused time to learning.');
  }

  if (analytics.certificatesEarned === 0 && analytics.templatesCompleted > 3) {
    insights.push('Complete more modules to earn your first certificate!');
  }

  return insights;
}

function Clock({ className }: { className: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
