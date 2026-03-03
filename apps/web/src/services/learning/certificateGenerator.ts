/**
 * Certificate & Achievement System
 *
 * Tracks user achievements:
 * - Module completion certificates
 * - Learning milestones (first template, 5 templates, all beginner, etc.)
 * - Achievement badges
 * - Certificate download/sharing
 */

export interface Certificate {
  id: string;
  type: 'module' | 'path' | 'milestone';
  title: string;
  issuedTo: string;
  issuedDate: string;
  moduleId?: string;
  pathId?: string;
  milestoneId?: string;
  verificationCode: string;
  signatureImage?: string; // base64 encoded
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  category: 'templates' | 'modules' | 'paths' | 'speedrun';
  threshold: number; // e.g., 5 templates started
  icon: string;
  reward: 'badge' | 'certificate' | 'title';
}

export interface AchievementBadge {
  id: string;
  milestoneId: string;
  earnedDate: string;
  title: string;
  icon: string;
}

const MILESTONES: Milestone[] = [
  {
    id: 'first-template',
    title: 'First Step',
    description: 'Complete your first educational template',
    category: 'templates',
    threshold: 1,
    icon: '🚀',
    reward: 'badge',
  },
  {
    id: 'five-templates',
    title: 'Template Explorer',
    description: 'Complete 5 educational templates',
    category: 'templates',
    threshold: 5,
    icon: '🗺️',
    reward: 'badge',
  },
  {
    id: 'all-beginner-templates',
    title: 'Beginner Master',
    description: 'Complete all 3 beginner templates',
    category: 'templates',
    threshold: 3,
    icon: '📚',
    reward: 'certificate',
  },
  {
    id: 'fundamentals-module',
    title: 'Fundamentals Complete',
    description: 'Complete the Fundamentals learning path',
    category: 'paths',
    threshold: 1,
    icon: '🏆',
    reward: 'certificate',
  },
  {
    id: 'expert-explorer',
    title: 'Expert Explorer',
    description: 'Complete 10 templates across all difficulty levels',
    category: 'templates',
    threshold: 10,
    icon: '⭐',
    reward: 'badge',
  },
];

export function getMilestoneById(id: string): Milestone | undefined {
  return MILESTONES.find((m) => m.id === id);
}

export function getAllMilestones(): Milestone[] {
  return MILESTONES;
}

export function generateCertificateId(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return `cert_${Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
}

export function generateVerificationCode(certificateId: string, timestamp: number): string {
  // Simple verification code using timestamp and cert ID
  const combined = `${certificateId}${timestamp}beamlab-secret`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).substring(0, 12).toUpperCase();
}

export function createModuleCertificate(
  userName: string,
  moduleTitle: string,
  moduleId: string,
): Certificate {
  const now = new Date().toISOString();
  const id = generateCertificateId();
  const timestamp = new Date().getTime();

  return {
    id,
    type: 'module',
    title: `Certificate of Completion: ${moduleTitle}`,
    issuedTo: userName,
    issuedDate: now,
    moduleId,
    verificationCode: generateVerificationCode(id, timestamp),
  };
}

export function createPathCertificate(
  userName: string,
  pathTitle: string,
  pathId: string,
): Certificate {
  const now = new Date().toISOString();
  const id = generateCertificateId();
  const timestamp = new Date().getTime();

  return {
    id,
    type: 'path',
    title: `Certificate of Achievement: ${pathTitle}`,
    issuedTo: userName,
    issuedDate: now,
    pathId,
    verificationCode: generateVerificationCode(id, timestamp),
  };
}

export function createMilestoneCertificate(
  userName: string,
  milestone: Milestone,
): Certificate {
  const now = new Date().toISOString();
  const id = generateCertificateId();
  const timestamp = new Date().getTime();

  return {
    id,
    type: 'milestone',
    title: `Achievement Unlocked: ${milestone.title}`,
    issuedTo: userName,
    issuedDate: now,
    milestoneId: milestone.id,
    verificationCode: generateVerificationCode(id, timestamp),
  };
}

export function formatCertificateDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function generateCertificateHTML(certificate: Certificate): string {
  const formattedDate = formatCertificateDate(certificate.issuedDate);
  const bgColor =
    certificate.type === 'module'
      ? 'from-blue-100 to-cyan-100'
      : certificate.type === 'path'
        ? 'from-purple-100 to-pink-100'
        : 'from-amber-100 to-orange-100';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${certificate.title}</title>
      <style>
        body { margin: 0; padding: 20px; font-family: 'Georgia', serif; background: #f5f5f5; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .certificate { border: 3px solid #2c3e50; padding: 40px; text-align: center; background: linear-gradient(135deg, var(--from) 0%, var(--to) 100%); }
        h1 { font-size: 28px; color: #2c3e50; margin: 20px 0; }
        .issued-to { font-size: 32px; font-weight: bold; color: #1a5f7a; margin: 30px 0; }
        .details { font-size: 14px; color: #555; margin: 20px 0; }
        .verification { margin-top: 30px; padding-top: 20px; border-top: 2px solid #2c3e50; font-size: 12px; color: #777; }
        .code { font-family: 'Courier New', monospace; font-weight: bold; color: #2c3e50; margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="certificate" style="--from: var(--gradient-from); --to: var(--gradient-to);">
          <h1>✓ ${certificate.title}</h1>
          <p style="font-size: 16px; color: #555; margin: 20px 0;">This certifies that</p>
          <div class="issued-to">${certificate.issuedTo}</div>
          <p style="font-size: 16px; color: #555; margin: 20px 0;">has successfully completed the requirements</p>
          <div class="details">Issued on ${formattedDate}</div>
          <div class="verification">
            <p>Certificate ID: <span class="code">${certificate.id}</span></p>
            <p>Verification Code: <span class="code">${certificate.verificationCode}</span></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function downloadCertificateAsImage(certificate: Certificate, fileName: string): void {
  const html = generateCertificateHTML(certificate);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}.html`;
  link.click();
  URL.revokeObjectURL(link.href);
}
