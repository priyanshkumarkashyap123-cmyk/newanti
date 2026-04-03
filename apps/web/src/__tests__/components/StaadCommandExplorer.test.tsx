/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StaadCommandExplorer } from '../../components/StaadCommandExplorer';
import { useUIStore } from '../../store/uiStore';
import { useModelStore } from '../../store/model';

describe('StaadCommandExplorer', () => {
  beforeEach(() => {
    useUIStore.getState().resetToDefaults();
    useModelStore.getState().clearModel();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useUIStore.getState().resetToDefaults();
    useModelStore.getState().clearModel();
  });

  it('renders summary cards and catalog list', () => {
    render(<StaadCommandExplorer isOpen onClose={() => {}} />);

    expect(screen.getByText('STAAD Command Explorer')).toBeTruthy();
    expect(screen.getByText('Total Commands')).toBeTruthy();
    expect(screen.getByText('Response Spectrum')).toBeTruthy();
  });

  it('filters command list by search query', async () => {
    const user = userEvent.setup();
    render(<StaadCommandExplorer isOpen onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText(/search by name, id, category, or description/i), 'hydrostatic');

    expect(screen.getByText('Add Hydrostatic')).toBeTruthy();
  });

  it('renders Export CSV button', () => {
    render(<StaadCommandExplorer isOpen onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /export csv/i })).toBeTruthy();
  });

  it('renders status filter chips: All, Ready, Partial, Limited', () => {
    render(<StaadCommandExplorer isOpen onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /^all\s/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^ready\s/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^partial\s/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^limited\s/i })).toBeTruthy();
  });

  it('renders readyPct progress indicator', () => {
    render(<StaadCommandExplorer isOpen onClose={() => {}} />);
    expect(screen.getByText(/\d+% ready/i)).toBeTruthy();
  });

  it('filtering by Ready status hides partial/limited commands', async () => {
    const user = userEvent.setup();
    render(<StaadCommandExplorer isOpen onClose={() => {}} />);

    await user.click(screen.getByRole('button', { name: /^ready\s/i }));

    // "Run Analysis" is ready — must remain
    expect(screen.getByText('Run Analysis')).toBeTruthy();
    // "Response Spectrum" is partial — must be hidden
    expect(screen.queryByText('Response Spectrum')).toBeNull();
  });

  it('Export CSV calls createObjectURL to build Blob download', async () => {
    const mockCreate = vi.fn(() => 'blob:mock-url');
    const mockRevoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: mockCreate, revokeObjectURL: mockRevoke });

    const clickSpy = vi.fn();
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });

    const user = userEvent.setup();
    render(<StaadCommandExplorer isOpen onClose={() => {}} />);

    await user.click(screen.getByRole('button', { name: /export csv/i }));

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalled();
  });

  it('shows Clear status filter link in empty state when filter active and no results', async () => {
    const user = userEvent.setup();
    render(<StaadCommandExplorer isOpen onClose={() => {}} />);

    await user.click(screen.getByRole('button', { name: /^ready\s/i }));
    await user.type(
      screen.getByPlaceholderText(/search by name, id, category, or description/i),
      'xyznotexistxyz'
    );

    expect(screen.getByText(/clear status filter/i)).toBeTruthy();
  });
});
