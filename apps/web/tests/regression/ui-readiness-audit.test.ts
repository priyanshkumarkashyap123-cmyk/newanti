import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..', '..');
const srcRoot = path.join(webRoot, 'src');

function collectFiles(dir: string, ext: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, ext, acc);
    } else if (entry.isFile() && fullPath.endsWith(ext)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function getRelative(filePath: string): string {
  return path.relative(webRoot, filePath).replaceAll(path.sep, '/');
}

function findMatches(pattern: RegExp, files: string[]): Array<{ file: string; snippet: string }> {
  const hits: Array<{ file: string; snippet: string }> = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const match = content.match(pattern);
    if (match) {
      hits.push({
        file: getRelative(file),
        snippet: match[0].slice(0, 140),
      });
    }
  }
  return hits;
}

const tsxFiles = collectFiles(srcRoot, '.tsx');
const tsFiles = collectFiles(srcRoot, '.ts');
const sourceFiles = [...tsxFiles, ...tsFiles].filter((file) => {
  const rel = getRelative(file);
  return !rel.includes('/__tests__/') && !rel.includes('/_demo/');
});

const approvedPrintSurfaces = new Set([
  'src/components/reporting/PrintPreview.tsx',
  'src/components/results/ResultsTableDock.tsx',
  'src/components/structural/CalculationReport.tsx',
  'src/pages/ProfessionalReportGenerator.tsx',
  'src/pages/ReportsPage.tsx',
  'src/pages/SpacePlanningPage.tsx',
  'src/pages/room-planner.tsx',
]);

const bannedUiPatterns = [
  {
    name: 'empty onClick handlers',
    pattern: /onClick\s*=\s*\{\s*\([^)]*\)\s*=>\s*\{\s*\}\s*\}/m,
  },
  {
    name: 'dead anchor links',
    pattern: /href\s*=\s*["']#["']/m,
  },
  {
    name: 'dead router links',
    pattern: /to\s*=\s*["']#["']/m,
  },
  {
    name: 'print-dialog PDF fallback',
    pattern: /window\.print\s*\(/m,
    allowList: approvedPrintSurfaces,
  },
];

const bannedLaunchPlaceholderTriggers = [
  'openModal("geotechnicalDesign")',
  'openModal("hydraulicsDesign")',
  'openModal("transportDesign")',
  'openModal("constructionMgmt")',
  'openModal("sectionOptimization")',
];

describe('UI production readiness audit', () => {
  it('contains no banned dead-action patterns in source files', () => {
    const violations = bannedUiPatterns.flatMap(({ name, pattern, allowList }) =>
      findMatches(pattern, sourceFiles)
        .filter((hit) => !allowList?.has(hit.file))
        .map((hit) => ({ ...hit, name })),
    );

    expect(
      violations,
      violations.length
        ? `Found UI readiness violations:\n${violations
            .map((v) => `- ${v.name}: ${v.file} :: ${v.snippet}`)
            .join('\n')}`
        : 'No dead-action patterns found',
    ).toEqual([]);
  });

  it('keeps launch-hidden coming-soon modal triggers out of primary launch surfaces', () => {
    const launchSurfaceFiles = [
      path.join(srcRoot, 'components/layout/EngineeringRibbon.tsx'),
      path.join(srcRoot, 'components/layout/SmartSidebar.tsx'),
      path.join(srcRoot, 'components/dashboard/AdvancedDashboard.tsx'),
      path.join(srcRoot, 'components/visualization/AnimationControls.tsx'),
    ];

    const violations: string[] = [];

    for (const file of launchSurfaceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const trigger of bannedLaunchPlaceholderTriggers) {
        if (content.includes(trigger)) {
          violations.push(`${getRelative(file)} still contains ${trigger}`);
        }
      }
    }

    expect(
      violations,
      violations.length ? violations.join('\n') : 'No blocked placeholder triggers found in launch surfaces',
    ).toEqual([]);
  });

  it('routes branded PDF exports through the unified trigger', () => {
    const exportToolbar = fs.readFileSync(
      path.join(srcRoot, 'components/export/ExportToolbar.tsx'),
      'utf8',
    );
    const resultsToolbar = fs.readFileSync(
      path.join(srcRoot, 'components/results/ResultsToolbar.tsx'),
      'utf8',
    );
    const modeler = fs.readFileSync(
      path.join(srcRoot, 'components/ModernModeler.tsx'),
      'utf8',
    );

    expect(exportToolbar).toContain("trigger-pdf-report");
    expect(modeler).toContain('addEventListener("trigger-pdf-report"');
    expect(resultsToolbar).toContain('projectInfo.name');
    expect(resultsToolbar).toContain('clientName: projectInfo.client');
    expect(resultsToolbar).toContain('engineerName: projectInfo.engineer');
  });
});
