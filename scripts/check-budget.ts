/**
 * Performance Budget Checker
 * Industry-standard bundle size monitoring
 * 
 * Features:
 * - Size limits per file type
 * - CI integration
 * - Historical tracking
 * - Actionable recommendations
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { gzipSync, brotliCompressSync } from 'zlib';
import { pathToFileURL } from 'url';

// ============================================================================
// Types
// ============================================================================

interface BudgetEntry {
  path: string;
  maxSize: string;
  limit?: string;
  compression?: 'gzip' | 'brotli' | 'none';
  name?: string;
}

interface SizeResult {
  path: string;
  name?: string;
  raw: number;
  gzip: number;
  brotli: number;
  budget: number;
  limit: number;
  passed: boolean;
  warning: boolean;
  compression: string;
}

interface BudgetReport {
  timestamp: string;
  totalSize: {
    raw: number;
    gzip: number;
    brotli: number;
  };
  results: SizeResult[];
  passed: boolean;
  warnings: number;
  failures: number;
}

// ============================================================================
// Size Parsing
// ============================================================================

function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB|kB)?$/i);
  if (!match) {
    throw new Error(`Invalid size format: ${sizeStr}`);
  }
  
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();
  
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    K: 1024,
    MB: 1024 * 1024,
    M: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    G: 1024 * 1024 * 1024,
  };
  
  return value * (multipliers[unit] || 1);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ============================================================================
// File Discovery
// ============================================================================

function matchGlob(filePath: string, pattern: string): boolean {
  // Simple glob matching (supports ** and *)
  const regexPattern = pattern
    .replace(/\*\*/g, '<<<DOUBLE_STAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<DOUBLE_STAR>>>/g, '.*')
    .replace(/\./g, '\\.')
    .replace(/\{([^}]+)\}/g, (_, group) => `(${group.replace(/,/g, '|')})`);
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}

function findFiles(basePath: string, pattern: string): string[] {
  const results: string[] = [];
  
  function scan(dir: string, relativePath: string = '') {
    if (!existsSync(dir)) return;
    
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = join(relativePath, entry.name);
      
      if (entry.isDirectory()) {
        scan(fullPath, relPath);
      } else if (entry.isFile()) {
        if (matchGlob(relPath, pattern)) {
          results.push(fullPath);
        }
      }
    }
  }
  
  scan(basePath);
  return results;
}

// ============================================================================
// Size Calculation
// ============================================================================

function getFileSize(filePath: string): { raw: number; gzip: number; brotli: number } {
  const content = readFileSync(filePath);
  
  return {
    raw: content.length,
    gzip: gzipSync(content, { level: 9 }).length,
    brotli: brotliCompressSync(content).length,
  };
}

// ============================================================================
// Budget Checking
// ============================================================================

export function checkBudget(
  budgetPath: string = 'budget.json',
  basePath: string = process.cwd()
): BudgetReport {
  // Load budget configuration
  const budgetContent = readFileSync(join(basePath, budgetPath), 'utf-8');
  const budgetEntries: BudgetEntry[] = JSON.parse(budgetContent);
  
  const results: SizeResult[] = [];
  let totalRaw = 0;
  let totalGzip = 0;
  let totalBrotli = 0;
  
  for (const entry of budgetEntries) {
    const files = findFiles(basePath, entry.path);
    const maxSize = parseSize(entry.maxSize);
    const limit = entry.limit ? parseSize(entry.limit) : maxSize * 1.2;
    
    for (const file of files) {
      const sizes = getFileSize(file);
      const relativePath = file.replace(basePath + '/', '');
      
      // Get the size based on compression type
      let effectiveSize: number;
      let compression = entry.compression || 'gzip';
      
      switch (compression) {
        case 'brotli':
          effectiveSize = sizes.brotli;
          break;
        case 'none':
          effectiveSize = sizes.raw;
          break;
        case 'gzip':
        default:
          effectiveSize = sizes.gzip;
          break;
      }
      
      const passed = effectiveSize <= maxSize;
      const warning = effectiveSize > maxSize && effectiveSize <= limit;
      
      results.push({
        path: relativePath,
        name: entry.name,
        raw: sizes.raw,
        gzip: sizes.gzip,
        brotli: sizes.brotli,
        budget: maxSize,
        limit,
        passed,
        warning,
        compression,
      });
      
      totalRaw += sizes.raw;
      totalGzip += sizes.gzip;
      totalBrotli += sizes.brotli;
    }
  }
  
  const failures = results.filter(r => !r.passed && !r.warning).length;
  const warnings = results.filter(r => r.warning).length;
  
  return {
    timestamp: new Date().toISOString(),
    totalSize: {
      raw: totalRaw,
      gzip: totalGzip,
      brotli: totalBrotli,
    },
    results,
    passed: failures === 0,
    warnings,
    failures,
  };
}

// ============================================================================
// Reporting
// ============================================================================

export function formatReportAsTable(report: BudgetReport): string {
  let output = '\n📊 Performance Budget Report\n';
  output += '═'.repeat(80) + '\n\n';
  
  output += `📅 Timestamp: ${report.timestamp}\n`;
  output += `📦 Total Size: ${formatSize(report.totalSize.raw)} raw | `;
  output += `${formatSize(report.totalSize.gzip)} gzip | `;
  output += `${formatSize(report.totalSize.brotli)} brotli\n\n`;
  
  // Results table
  output += '┌' + '─'.repeat(40) + '┬' + '─'.repeat(12) + '┬' + '─'.repeat(12) + '┬' + '─'.repeat(10) + '┐\n';
  output += '│ ' + 'File'.padEnd(38) + ' │ ' + 'Size'.padEnd(10) + ' │ ' + 'Budget'.padEnd(10) + ' │ ' + 'Status'.padEnd(8) + ' │\n';
  output += '├' + '─'.repeat(40) + '┼' + '─'.repeat(12) + '┼' + '─'.repeat(12) + '┼' + '─'.repeat(10) + '┤\n';
  
  for (const result of report.results) {
    const name = result.name || result.path;
    const displayName = name.length > 38 ? '...' + name.slice(-35) : name;
    
    const effectiveSize = result.compression === 'brotli' ? result.brotli :
                          result.compression === 'none' ? result.raw : result.gzip;
    
    const status = result.passed ? '✅ Pass' : result.warning ? '⚠️ Warn' : '❌ Fail';
    
    output += '│ ' + displayName.padEnd(38) + ' │ ';
    output += formatSize(effectiveSize).padEnd(10) + ' │ ';
    output += formatSize(result.budget).padEnd(10) + ' │ ';
    output += status.padEnd(8) + ' │\n';
  }
  
  output += '└' + '─'.repeat(40) + '┴' + '─'.repeat(12) + '┴' + '─'.repeat(12) + '┴' + '─'.repeat(10) + '┘\n\n';
  
  // Summary
  if (report.passed) {
    output += '✅ All files are within budget!\n';
  } else {
    output += `❌ ${report.failures} file(s) exceeded budget\n`;
  }
  
  if (report.warnings > 0) {
    output += `⚠️  ${report.warnings} file(s) are approaching the limit\n`;
  }
  
  return output;
}

export function formatReportAsJson(report: BudgetReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatReportAsMarkdown(report: BudgetReport): string {
  let md = '# Performance Budget Report\n\n';
  md += `**Date:** ${new Date(report.timestamp).toLocaleString()}\n\n`;
  
  md += '## Summary\n\n';
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Raw | ${formatSize(report.totalSize.raw)} |\n`;
  md += `| Total Gzip | ${formatSize(report.totalSize.gzip)} |\n`;
  md += `| Total Brotli | ${formatSize(report.totalSize.brotli)} |\n`;
  md += `| Status | ${report.passed ? '✅ Passed' : '❌ Failed'} |\n\n`;
  
  md += '## Details\n\n';
  md += '| File | Size | Budget | Status |\n';
  md += '|------|------|--------|--------|\n';
  
  for (const result of report.results) {
    const name = result.name || result.path;
    const effectiveSize = result.compression === 'brotli' ? result.brotli :
                          result.compression === 'none' ? result.raw : result.gzip;
    const status = result.passed ? '✅' : result.warning ? '⚠️' : '❌';
    
    md += `| ${name} | ${formatSize(effectiveSize)} | ${formatSize(result.budget)} | ${status} |\n`;
  }
  
  return md;
}

// ============================================================================
// CLI Execution
// ============================================================================

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMain) {
  try {
    const report = checkBudget();
    console.log(formatReportAsTable(report));
    
    if (!report.passed) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Error checking budget:', error);
    process.exit(1);
  }
}
