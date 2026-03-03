/**
 * Milestone Unlocker Service
 *
 * Checks for and unlocks achievement milestones based on user progress
 * - Tracks template completions
 * - Detects milestone achievements
 * - Generates certificates and badges
 */

import {
  Certificate,
  AchievementBadge,
  getAllMilestones,
  createMilestoneCertificate,
  generateCertificateId,
} from './certificateGenerator';
import type { LearningProgressState } from './progressTracker';

export interface UnlockResult {
  unlockedMilestones: string[];
  newCertificates: Certificate[];
  newBadges: AchievementBadge[];
}

export function checkMilestoneUnlocks(
  progressState: LearningProgressState,
  userName: string = 'Learner',
): UnlockResult {
  const result: UnlockResult = {
    unlockedMilestones: [],
    newCertificates: [],
    newBadges: [],
  };

  const completedCount = progressState.templatesCompleted.length;
  const existingMilestoneIds = new Set(progressState.badges.map((b) => b.milestoneId));

  const milestones = getAllMilestones();

  for (const milestone of milestones) {
    // Skip if already earned
    if (existingMilestoneIds.has(milestone.id)) continue;

    // Check if milestone threshold is met
    let thresholdMet = false;

    if (milestone.id === 'first-template' && completedCount >= 1) {
      thresholdMet = true;
    } else if (milestone.id === 'five-templates' && completedCount >= 5) {
      thresholdMet = true;
    } else if (milestone.id === 'all-beginner-templates') {
      // Check if all beginner template IDs are completed
      const beginnerTemplateIds = [
        'intro-2d-simply-supported',
        'intro-2d-cantilever',
        'intro-load-types',
      ];
      const allBeginnerComplete = beginnerTemplateIds.every((id) =>
        progressState.templatesCompleted.includes(id),
      );
      thresholdMet = allBeginnerComplete;
    } else if (milestone.id === 'fundamentals-module') {
      // Check if Fundamentals module is completed
      const fundamentalsCompleted = progressState.modules.Fundamentals?.completedAt !== undefined;
      thresholdMet = fundamentalsCompleted;
    } else if (milestone.id === 'expert-explorer' && completedCount >= 10) {
      thresholdMet = true;
    }

    // Unlock milestone if threshold met
    if (thresholdMet) {
      result.unlockedMilestones.push(milestone.id);

      if (milestone.reward === 'badge') {
        const badge: AchievementBadge = {
          id: `badge_${milestone.id}_${Date.now()}`,
          milestoneId: milestone.id,
          earnedDate: new Date().toISOString(),
          title: milestone.title,
          icon: milestone.icon,
        };
        result.newBadges.push(badge);
      } else if (milestone.reward === 'certificate') {
        const cert = createMilestoneCertificate(userName, milestone);
        result.newCertificates.push(cert);
      }
    }
  }

  return result;
}

export function applyMilestoneUnlocks(
  progressState: LearningProgressState,
  unlockResult: UnlockResult,
): LearningProgressState {
  let updated = progressState;

  // Add new badges
  for (const badge of unlockResult.newBadges) {
    updated = {
      ...updated,
      badges: [...updated.badges, badge],
    };
  }

  // Add new certificates
  for (const cert of unlockResult.newCertificates) {
    updated = {
      ...updated,
      certificates: [...updated.certificates, cert],
    };
  }

  return updated;
}

export function getUnlockedMilestoneNotifications(unlockResult: UnlockResult): string[] {
  const notifications: string[] = [];

  for (const badgeId of unlockResult.newBadges) {
    notifications.push(`🎉 Badge earned: ${badgeId.title}`);
  }

  for (const certId of unlockResult.newCertificates) {
    notifications.push(`🏆 Certificate awarded: ${certId.title}`);
  }

  return notifications;
}
