import { describe, expect, it } from 'vitest';
import { CATEGORY_TOOLS } from '../../store/uiStore';
import {
  getStaadCommandCatalog,
  getStaadCommandStats,
  getStaadCommandCatalogCsv,
} from '../../data/staadCommandCatalog';

describe('staadCommandCatalog', () => {
  it('covers all CATEGORY_TOOLS entries', () => {
    const catalog = getStaadCommandCatalog();
    const expected = Object.values(CATEGORY_TOOLS).reduce((sum, tools) => sum + tools.length, 0);

    expect(catalog.length).toBe(expected);
    expect(catalog.some((entry) => entry.toolId === 'RESPONSE_SPECTRUM')).toBe(true);
    expect(catalog.some((entry) => entry.toolId === 'ADD_HYDROSTATIC')).toBe(true);
  });

  it('returns consistent status totals and readyPct', () => {
    const catalog = getStaadCommandCatalog();
    const stats = getStaadCommandStats(catalog);

    expect(stats.total).toBe(catalog.length);
    expect(stats.ready + stats.partial + stats.comingSoon).toBe(stats.total);

    // readyPct must be an integer in [0, 100]
    expect(Number.isInteger(stats.readyPct)).toBe(true);
    expect(stats.readyPct).toBeGreaterThanOrEqual(0);
    expect(stats.readyPct).toBeLessThanOrEqual(100);

    // Verify the calculation manually
    const expectedPct = stats.total > 0 ? Math.round((stats.ready / stats.total) * 100) : 0;
    expect(stats.readyPct).toBe(expectedPct);
  });

  it('every entry has a non-empty description string', () => {
    const catalog = getStaadCommandCatalog();
    for (const entry of catalog) {
      expect(typeof entry.description).toBe('string');
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a keywords array', () => {
    const catalog = getStaadCommandCatalog();
    for (const entry of catalog) {
      expect(Array.isArray(entry.keywords)).toBe(true);
    }
  });

  it('getStaadCommandCatalogCsv returns valid CSV with header and data rows', () => {
    const catalog = getStaadCommandCatalog();
    const csv = getStaadCommandCatalogCsv(catalog);

    const lines = csv.split('\n');
    // Header + one row per catalog entry
    expect(lines.length).toBe(catalog.length + 1);

    // Header has correct columns
    expect(lines[0]).toBe('Category,Tool ID,Label,Status,Execution Tier,Description');

    // Each data row has at least 5 commas (6 columns)
    for (const line of lines.slice(1)) {
      const commaCount = (line.match(/,/g) ?? []).length;
      expect(commaCount).toBeGreaterThanOrEqual(5);
    }
  });

  it('CSV contains known entries for RESPONSE_SPECTRUM and ADD_HYDROSTATIC', () => {
    const catalog = getStaadCommandCatalog();
    const csv = getStaadCommandCatalogCsv(catalog);

    expect(csv).toContain('RESPONSE_SPECTRUM');
    expect(csv).toContain('ADD_HYDROSTATIC');
  });
});
