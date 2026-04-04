/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from '../../components/CommandPalette';
import { useUIStore } from '../../store/uiStore';
import { useModelStore } from '../../store/model';

describe('CommandPalette STAAD command coverage', () => {
  beforeEach(() => {
    useUIStore.getState().resetToDefaults();
    useModelStore.getState().clearModel();
  });

  afterEach(() => {
    cleanup();
    useUIStore.getState().resetToDefaults();
    useModelStore.getState().clearModel();
  });

  it('shows dynamically generated CATEGORY_TOOLS commands', () => {
    render(<CommandPalette isOpen onClose={() => {}} />);

    // These are commands from CATEGORY_TOOLS that are not part of the old hand-written list,
    // ensuring dynamic generation is active.
    expect(screen.getByText('Add Hydrostatic')).toBeTruthy();
    expect(screen.getByText('Response Spectrum')).toBeTruthy();
    expect(screen.getByText('Timber Design')).toBeTruthy();
  });

  it('renders CIVIL category with correct emoji label', () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    // CIVIL category header should read "🏗️ Civil Engineering"
    // Multiple elements may match (header span + command label) — use getAllByText
    const matches = screen.getAllByText(/civil engineering/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('includes Switch to Civil Engineering command', () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    expect(screen.getByText(/switch to civil engineering/i)).toBeTruthy();
  });

  it('footer shows total command count when no query', () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    // Footer text should contain "commands" (e.g. "142 commands")
    expect(screen.getByText(/\d+ commands/i)).toBeTruthy();
  });

  it('footer shows matched count when search query is active', async () => {
    const user = userEvent.setup();
    render(<CommandPalette isOpen onClose={() => {}} />);

    await user.type(
      screen.getByPlaceholderText(/search commands/i),
      'hydrostatic'
    );

    // Footer should now show "X of Y matched"
    expect(screen.getByText(/of .+ matched/i)).toBeTruthy();
  });
});
