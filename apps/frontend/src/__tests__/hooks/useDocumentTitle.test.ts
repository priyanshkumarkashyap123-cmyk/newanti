/**
 * Tests for useDocumentTitle hook
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

describe('useDocumentTitle', () => {
  afterEach(() => {
    cleanup();
    document.title = '';
  });

  it('should set document title with site name suffix', () => {
    renderHook(() => useDocumentTitle('Dashboard'));
    expect(document.title).toBe('Dashboard | BeamLab');
  });

  it('should set only site name when title is empty', () => {
    renderHook(() => useDocumentTitle(''));
    expect(document.title).toBe('BeamLab');
  });

  it('should restore previous title on unmount by default', () => {
    document.title = 'Previous Title';
    const { unmount } = renderHook(() => useDocumentTitle('New Page'));
    expect(document.title).toBe('New Page | BeamLab');
    unmount();
    expect(document.title).toBe('Previous Title');
  });

  it('should not restore title when restoreOnUnmount is false', () => {
    document.title = 'Previous Title';
    const { unmount } = renderHook(() =>
      useDocumentTitle('Permanent', { restoreOnUnmount: false }),
    );
    expect(document.title).toBe('Permanent | BeamLab');
    unmount();
    expect(document.title).toBe('Permanent | BeamLab');
  });

  it('should update title when the title prop changes', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Page A' },
    });
    expect(document.title).toBe('Page A | BeamLab');

    rerender({ title: 'Page B' });
    expect(document.title).toBe('Page B | BeamLab');
  });
});
