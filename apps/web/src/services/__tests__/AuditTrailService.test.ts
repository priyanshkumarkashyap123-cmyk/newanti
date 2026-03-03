/**
 * AuditTrailService.test.ts — Tests for the AuditTrailService class
 *
 * Validates logging, querying, filtering, report generation,
 * and storage lifecycle.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import AuditTrailService from '@/services/AuditTrailService';

// Stub localStorage so the service doesn't throw in Node/jsdom
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('AuditTrailService', () => {
  let service: AuditTrailService;

  beforeEach(() => {
    localStorageMock.clear();
    service = new AuditTrailService();
  });

  // ──────────────────────────────────────────
  // log()
  // ──────────────────────────────────────────

  it('log() creates an entry with the correct shape', () => {
    const entry = service.log('model_creation', 'create', 'Added beam');
    expect(entry).toBeDefined();
    expect(entry.id).toContain('audit');
    expect(entry.category).toBe('model_creation');
    expect(entry.type).toBe('model_creation'); // alias
    expect(entry.action).toBe('create');
    expect(entry.description).toBe('Added beam');
    expect(entry.timestamp).toBeInstanceOf(Date);
    expect(entry.aiGenerated).toBe(false);
  });

  it('log() with aiGenerated flag sets the property', () => {
    const entry = service.log('ai_recommendation', 'suggest', 'Use W12x26', {
      aiGenerated: true,
      confidence: 0.92,
    });
    expect(entry.aiGenerated).toBe(true);
    expect(entry.confidence).toBe(0.92);
  });

  // ──────────────────────────────────────────
  // getEntries / filtering
  // ──────────────────────────────────────────

  it('getEntries() returns all logged entries (including session start)', () => {
    service.log('model_creation', 'a1', 'd1');
    service.log('analysis_result', 'a2', 'd2');
    // The constructor already logs a session start entry
    const all = service.getEntries();
    expect(all.length).toBeGreaterThanOrEqual(3);
  });

  it('getEntries() filters by category', () => {
    service.log('model_creation', 'a1', 'd1');
    service.log('model_creation', 'a2', 'd2');
    service.log('analysis_result', 'a3', 'd3');

    const creations = service.getEntries({ category: 'model_creation' });
    expect(creations.length).toBe(2);
    creations.forEach((e) => expect(e.category).toBe('model_creation'));
  });

  it('getEntries() filters by aiGenerated flag', () => {
    service.log('ai_recommendation', 'rec', 'Use ISMB 300', { aiGenerated: true });
    service.log('model_creation', 'create', 'Manual node', { aiGenerated: false });

    const aiOnly = service.getEntries({ aiGenerated: true });
    expect(aiOnly.length).toBe(1);
    expect(aiOnly[0].aiGenerated).toBe(true);
  });

  // ──────────────────────────────────────────
  // Report generation
  // ──────────────────────────────────────────

  it('generateReport() returns a valid report object', () => {
    service.log('design_check', 'check_capacity', 'Section OK');
    const report = service.generateReport('Jane Doe', 'PE-12345');

    expect(report.projectName).toBe('Untitled Project');
    expect(report.generatedBy).toBe('Jane Doe');
    expect(report.signatureBlock.professionalLicense).toBe('PE-12345');
    expect(report.summary.totalEntries).toBeGreaterThanOrEqual(2); // session + our entry
  });

  it('generateReportMarkdown() returns a markdown string', () => {
    service.log('model_creation', 'create', 'Frame created');
    const md = service.generateReportMarkdown('Engineer A');

    expect(typeof md).toBe('string');
    expect(md).toContain('# Structural Analysis Audit Report');
    expect(md).toContain('Engineer A');
  });

  // ──────────────────────────────────────────
  // clear()
  // ──────────────────────────────────────────

  it('clear() empties the trail', () => {
    service.log('model_creation', 'a', 'd');
    service.clear();

    expect(service.getEntries()).toHaveLength(0);
    expect(service.getCurrentModelVersion()).toBe(0);
  });

  // ──────────────────────────────────────────
  // exportJSON / importJSON
  // ──────────────────────────────────────────

  it('exportJSON() returns valid JSON', () => {
    service.log('model_creation', 'create', 'Truss');
    const json = service.exportJSON();
    const parsed = JSON.parse(json);

    expect(parsed.entries).toBeDefined();
    expect(Array.isArray(parsed.entries)).toBe(true);
    expect(parsed.projectName).toBe('Untitled Project');
  });

  it('importJSON() restores entries from JSON', () => {
    const payload = JSON.stringify({
      entries: [
        {
          id: 'audit-1',
          timestamp: new Date().toISOString(),
          category: 'model_creation',
          type: 'model_creation',
          action: 'create',
          description: 'Imported entry',
          aiGenerated: false,
          metadata: {},
        },
      ],
      modelVersions: [],
      projectName: 'Imported',
    });

    service.importJSON(payload);
    expect(service.getEntries()).toHaveLength(1);
  });

  // ──────────────────────────────────────────
  // Stats
  // ──────────────────────────────────────────

  it('getStats() returns correct counts', () => {
    service.log('model_creation', 'a', 'd', { aiGenerated: true });
    service.log('user_override', 'b', 'd');
    const stats = service.getStats();

    expect(stats.total).toBeGreaterThanOrEqual(3); // session + 2
    expect(stats.aiGenerated).toBeGreaterThanOrEqual(1);
    expect(stats.userOverrides).toBeGreaterThanOrEqual(1);
    expect(stats.byCategory).toBeDefined();
  });
});
