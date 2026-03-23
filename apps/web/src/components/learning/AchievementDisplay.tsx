/**
 * Achievement Display Component
 *
 * Shows:
 * - Earned achievement badges
 * - Earned certificates with download capability
 * - Progress toward next milestone
 */

import { useState } from 'react';
import { AchievementBadge, Certificate, getMilestoneById, getAllMilestones } from '@/services/learning/certificateGenerator';
import { LearningProgressState, getTemplatesCompletedCount } from '@/services/learning/progressTracker';
import type { Milestone } from '@/services/learning/certificateGenerator';

interface AchievementDisplayProps {
  progressState: LearningProgressState;
}

export function AchievementDisplay({ progressState }: AchievementDisplayProps) {
  const [expandedCerts, setExpandedCerts] = useState<string | null>(null);

  const completedCount = getTemplatesCompletedCount(progressState);
  const badges = progressState.badges || [];
  const certificates = progressState.certificates || [];

  const nextMilestone = getNextMilestone(completedCount);
  const progressPercent = nextMilestone
    ? Math.min(100, (completedCount / nextMilestone.threshold) * 100)
    : 100;

  const handleDownloadCertificate = (cert: Certificate) => {
    const html = generateCertificateHTML(cert);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cert.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-8 space-y-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      {/* Earned Badges */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Achievement Badges ({badges.length})
        </h3>
        {badges.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Complete templates to earn achievement badges!
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className="flex flex-col items-center rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 text-center dark:border-amber-900 dark:from-amber-950 dark:to-orange-950"
              >
                <div className="mb-2 text-3xl">{badge.icon}</div>
                <div className="text-xs font-medium tracking-wide text-gray-700 dark:text-gray-300">{badge.title}</div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {new Date(badge.earnedDate).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Earned Certificates */}
      {certificates.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Certificates ({certificates.length})
          </h3>
          <div className="space-y-3">
            {certificates.map((cert) => (
              <div key={cert.id} className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 p-4 dark:border-blue-900 dark:from-blue-950 dark:to-cyan-950">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium tracking-wide text-gray-900 dark:text-white">{cert.title}</h4>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      Issued: {new Date(cert.issuedDate).toLocaleDateString()}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                      Verification: {cert.verificationCode}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownloadCertificate(cert)}
                    className="ml-4 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium tracking-wide text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress to Next Milestone */}
      {nextMilestone && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Next Milestone</h3>
          <div className="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-4 dark:border-purple-900 dark:from-purple-950 dark:to-pink-950">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-2xl">{nextMilestone.icon}</div>
                <h4 className="mt-2 font-medium tracking-wide text-gray-900 dark:text-white">{nextMilestone.title}</h4>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{nextMilestone.description}</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {completedCount}/{nextMilestone.threshold}
                </div>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-300 dark:bg-gray-700">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Completion Message */}
      {progressPercent >= 100 && !nextMilestone && (
        <div className="rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4 dark:border-green-900 dark:from-green-950 dark:to-emerald-950">
          <p className="text-center text-sm font-medium tracking-wide text-green-900 dark:text-green-100">
            🎉 Congratulations! You've achieved all milestones!
          </p>
        </div>
      )}
    </div>
  );
}

function getNextMilestone(completedCount: number): Milestone | null {
  const milestones = getAllMilestones();
  const sorted = [...milestones].sort((a, b) => a.threshold - b.threshold);
  for (const milestone of sorted) {
    if (completedCount < milestone.threshold) {
      return milestone;
    }
  }
  return null;
}

function generateCertificateHTML(cert: Certificate): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${cert.title} - BeamLab Certificate</title>
      <style>
        body {
          margin: 0;
          padding: 20px;
          font-family: 'Georgia', serif;
          background: #f5f5f5;
        }
        .certificate {
          max-width: 900px;
          margin: 0 auto;
          width: 900px;
          height: 600px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          position: relative;
          overflow: hidden;
        }
        .certificate-type-module {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .certificate-type-path {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .certificate-type-milestone {
          background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
        }
        .certificate::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }
        .certificate-content {
          position: relative;
          z-index: 1;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          color: white;
          text-align: center;
          border: 3px solid rgba(255,255,255,0.3);
          padding: 20px;
          box-sizing: border-box;
        }
        .header {
          font-size: 14px;
          letter-spacing: 2px;
          font-weight: 300;
          text-transform: uppercase;
        }
        .title {
          font-size: 48px;
          margin: 20px 0;
          font-weight: bold;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .recipient {
          font-size: 24px;
          margin: 10px 0;
          font-style: italic;
        }
        .footer {
          font-size: 12px;
          opacity: 0.9;
        }
        .verification {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(255,255,255,0.5);
          font-family: 'Courier New', monospace;
          font-size: 10px;
        }
        @media print {
          body {
            padding: 0;
            background: white;
          }
          .certificate {
            box-shadow: none;
            margin: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="certificate certificate-type-${cert.type}">
        <div class="certificate-content">
          <div class="header">Certificate of Achievement</div>
          <div>
            <div class="title">${cert.title}</div>
            <div>This certifies that</div>
            <div class="recipient">${cert.issuedTo}</div>
            <div>has successfully completed this achievement</div>
          </div>
          <div class="footer">
            <div>Issued: ${new Date(cert.issuedDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}</div>
            <div class="verification">
              Certificate ID: ${cert.id}<br/>
              Verification Code: ${cert.verificationCode}
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
