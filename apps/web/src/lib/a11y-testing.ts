/**
 * Axe-Core Accessibility Testing Utilities
 * Industry-standard WCAG 2.1 AA compliance testing
 * 
 * Features:
 * - Playwright integration
 * - React Testing Library integration
 * - Configurable rule sets
 * - Detailed violation reporting
 */

import type { Page } from '@playwright/test';
import type { Result, NodeResult, ImpactValue } from 'axe-core';

// ============================================================================
// Types
// ============================================================================

export interface AccessibilityViolation {
  id: string;
  impact: ImpactValue | undefined;
  description: string;
  help: string;
  helpUrl: string;
  nodes: {
    html: string;
    target: string[];
    failureSummary?: string;
  }[];
}

export interface AccessibilityReport {
  timestamp: string;
  url: string;
  violations: AccessibilityViolation[];
  passes: number;
  incomplete: number;
  inapplicable: number;
  wcagLevel: 'A' | 'AA' | 'AAA';
}

export interface AxeRuleConfig {
  enabled?: boolean;
  selector?: string;
  excludeHidden?: boolean;
  rules?: {
    id: string;
    enabled?: boolean;
    selector?: string;
  }[];
}

// ============================================================================
// WCAG 2.1 AA Rule Tags
// ============================================================================

export const WCAG_21_AA_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'best-practice',
];

export const CRITICAL_RULES = [
  'color-contrast',
  'duplicate-id',
  'empty-heading',
  'html-has-lang',
  'image-alt',
  'label',
  'link-name',
  'list',
  'listitem',
  'meta-viewport',
];

// ============================================================================
// Axe Playwright Integration
// ============================================================================

/**
 * Injects axe-core into a Playwright page for testing
 */
export async function injectAxe(page: Page): Promise<void> {
  // Using CDN for axe-core
  await page.addScriptTag({
    url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.4/axe.min.js',
  });
  
  // Wait for axe to be available
  await page.waitForFunction(() => 'axe' in window);
}

/**
 * Runs axe accessibility analysis on a Playwright page
 */
export async function checkA11y(
  page: Page,
  options: {
    selector?: string;
    includedImpacts?: ImpactValue[];
    disabledRules?: string[];
    wcagLevel?: 'A' | 'AA' | 'AAA';
  } = {}
): Promise<AccessibilityReport> {
  const {
    selector = 'body',
    includedImpacts = ['critical', 'serious', 'moderate'],
    disabledRules = [],
    wcagLevel = 'AA',
  } = options;

  // Build axe config
  const wcagTags = getWcagTags(wcagLevel);
  const config = {
    runOnly: {
      type: 'tag' as const,
      values: wcagTags,
    },
    rules: disabledRules.reduce((acc, rule) => {
      acc[rule] = { enabled: false };
      return acc;
    }, {} as Record<string, { enabled: boolean }>),
  };

  // Run axe analysis
   
  const results = await page.evaluate(
    // @ts-expect-error - Playwright evaluate signature is flexible
    ([sel, cfg]: [string, Record<string, unknown>]) => {
      // @ts-expect-error - axe is injected via script tag
      return window.axe.run(sel, cfg);
    },
    [selector, config] as const
  );

  // Filter violations by impact
  const filteredViolations = results.violations.filter(
    (v: Result) => !v.impact || includedImpacts.includes(v.impact as ImpactValue)
  );

  return {
    timestamp: new Date().toISOString(),
    url: page.url(),
    violations: filteredViolations.map(formatViolation),
    passes: results.passes.length,
    incomplete: results.incomplete.length,
    inapplicable: results.inapplicable.length,
    wcagLevel,
  };
}

/**
 * Asserts that a page has no accessibility violations
 */
export async function expectNoA11yViolations(
  page: Page,
  options?: Parameters<typeof checkA11y>[1]
): Promise<void> {
  const report = await checkA11y(page, options);
  
  if (report.violations.length > 0) {
    const violationMessages = report.violations
      .map(v => `
- ${v.id} (${v.impact}): ${v.description}
  Help: ${v.helpUrl}
  Elements:
${v.nodes.map(n => `    - ${n.target.join(' > ')}\n      ${n.failureSummary}`).join('\n')}
`)
      .join('\n');
    
    throw new Error(
      `Found ${report.violations.length} accessibility violations:\n${violationMessages}`
    );
  }
}

// ============================================================================
// React Testing Library Integration
// ============================================================================

/**
 * Check accessibility for a React Testing Library container
 * Use with @testing-library/react and axe-core
 */
export async function checkContainerA11y(
  container: HTMLElement,
  options: AxeRuleConfig = {}
): Promise<Result[]> {
  // Dynamically import axe-core for jest/vitest
  const axe = await import('axe-core');
  
  const config = {
    ...options,
    rules: options.rules?.reduce((acc, rule) => {
      acc[rule.id] = { enabled: rule.enabled ?? true };
      return acc;
    }, {} as Record<string, { enabled: boolean }>),
  };

  const results = await axe.default.run(container, config);
  return results.violations;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getWcagTags(level: 'A' | 'AA' | 'AAA'): string[] {
  const tags = ['wcag2a', 'wcag21a', 'best-practice'];
  
  if (level === 'AA' || level === 'AAA') {
    tags.push('wcag2aa', 'wcag21aa');
  }
  
  if (level === 'AAA') {
    tags.push('wcag2aaa', 'wcag21aaa');
  }
  
  return tags;
}

function formatViolation(violation: Result): AccessibilityViolation {
  return {
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.map((node: NodeResult) => ({
      html: node.html,
      target: node.target as string[],
      failureSummary: node.failureSummary,
    })),
  };
}

// ============================================================================
// Accessibility Audit Presets
// ============================================================================

export const auditPresets = {
  /**
   * Strict audit - all WCAG 2.1 AA rules enabled
   */
  strict: {
    includedImpacts: ['critical', 'serious', 'moderate', 'minor'] as ImpactValue[],
    disabledRules: [],
    wcagLevel: 'AA' as const,
  },
  
  /**
   * Standard audit - critical and serious issues only
   */
  standard: {
    includedImpacts: ['critical', 'serious'] as ImpactValue[],
    disabledRules: [],
    wcagLevel: 'AA' as const,
  },
  
  /**
   * Relaxed audit - critical issues only
   */
  relaxed: {
    includedImpacts: ['critical'] as ImpactValue[],
    disabledRules: ['color-contrast'], // Often needs manual review
    wcagLevel: 'A' as const,
  },
  
  /**
   * Component audit - for isolated component testing
   */
  component: {
    includedImpacts: ['critical', 'serious', 'moderate'] as ImpactValue[],
    disabledRules: [
      'document-title', // Components don't set document title
      'html-has-lang', // Components don't set html lang
      'landmark-one-main', // Components may not have main landmark
      'page-has-heading-one', // Components may not have h1
    ],
    wcagLevel: 'AA' as const,
  },
};

// ============================================================================
// Reporting
// ============================================================================

export function formatReportAsMarkdown(report: AccessibilityReport): string {
  let md = `# Accessibility Report\n\n`;
  md += `**URL:** ${report.url}\n`;
  md += `**Timestamp:** ${report.timestamp}\n`;
  md += `**WCAG Level:** ${report.wcagLevel}\n\n`;
  
  md += `## Summary\n\n`;
  md += `| Status | Count |\n`;
  md += `|--------|-------|\n`;
  md += `| ❌ Violations | ${report.violations.length} |\n`;
  md += `| ✅ Passes | ${report.passes} |\n`;
  md += `| ⚠️ Incomplete | ${report.incomplete} |\n`;
  md += `| ➖ Inapplicable | ${report.inapplicable} |\n\n`;
  
  if (report.violations.length > 0) {
    md += `## Violations\n\n`;
    
    for (const violation of report.violations) {
      md += `### ${violation.id}\n\n`;
      md += `**Impact:** ${violation.impact}\n\n`;
      md += `**Description:** ${violation.description}\n\n`;
      md += `**Help:** [${violation.help}](${violation.helpUrl})\n\n`;
      md += `**Affected Elements:**\n\n`;
      
      for (const node of violation.nodes) {
        md += `- \`${node.target.join(' > ')}\`\n`;
        if (node.failureSummary) {
          md += `  - ${node.failureSummary}\n`;
        }
      }
      
      md += `\n`;
    }
  }
  
  return md;
}

export function formatReportAsJson(report: AccessibilityReport): string {
  return JSON.stringify(report, null, 2);
}
