/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GeometryToolsPanel } from '../../components/GeometryToolsPanel';
import { useModelStore } from '../../store/model';
import { useUIStore } from '../../store/uiStore';

describe('GeometryToolsPanel', () => {
  beforeEach(() => {
    useModelStore.getState().clearModel();
    useUIStore.getState().resetToDefaults();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useModelStore.getState().clearModel();
    useUIStore.getState().resetToDefaults();
  });

  it('shows Auto-Node tool and tolerance input', async () => {
    const user = userEvent.setup();
    render(<GeometryToolsPanel isOpen onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /auto-node/i }));
    expect(screen.getByText(/auto-node intersections/i)).toBeTruthy();
    expect(screen.getByText(/intersection tolerance \(m\)/i)).toBeTruthy();
  });

  it('enables auto-node execution when model has at least 2 members', async () => {
    const user = userEvent.setup();
    useModelStore.getState().addNode({ id: 'N1', x: 0, y: 0, z: 0 });
    useModelStore.getState().addNode({ id: 'N2', x: 1, y: 1, z: 0 });
    useModelStore.getState().addNode({ id: 'N3', x: 0, y: 1, z: 0 });
    useModelStore.getState().addNode({ id: 'N4', x: 1, y: 0, z: 0 });
    useModelStore.getState().addMember({ id: 'M1', startNodeId: 'N1', endNodeId: 'N2' });
    useModelStore.getState().addMember({ id: 'M2', startNodeId: 'N3', endNodeId: 'N4' });
    render(<GeometryToolsPanel isOpen onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /auto-node/i }));
    const executeButton = screen.getByRole('button', { name: /execute auto-node/i });
    expect(executeButton.hasAttribute('disabled')).toBe(false);
  });

  it('renders all 9 tools in the grid', () => {
    render(<GeometryToolsPanel isOpen onClose={() => {}} />);
    const toolNames = ['Extrude', 'Rotate Copy', 'Mirror', 'Split', 'Divide', 'Align', 'Move', 'Renumber', 'Auto-Node'];
    for (const name of toolNames) {
      expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeTruthy();
    }
  });

  it('shows Number of Segments input when Divide is active', async () => {
    const user = userEvent.setup();
    render(<GeometryToolsPanel isOpen onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /^divide$/i }));
    expect(screen.getByText(/number of segments/i)).toBeTruthy();
  });

  it('shows Execute Divide button when Divide is active', async () => {
    const user = userEvent.setup();
    render(<GeometryToolsPanel isOpen onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /^divide$/i }));
    expect(screen.getByRole('button', { name: /execute divide/i })).toBeTruthy();
  });

  it('Execute Divide is disabled when no member is selected', async () => {
    const user = userEvent.setup();
    render(<GeometryToolsPanel isOpen onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /^divide$/i }));
    const execBtn = screen.getByRole('button', { name: /execute divide/i });
    expect(execBtn.hasAttribute('disabled')).toBe(true);
  });

  it('shows Align Axis and Align To controls when Align is active', async () => {
    const user = userEvent.setup();
    render(<GeometryToolsPanel isOpen onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /^align$/i }));
    expect(screen.getByText(/align axis/i)).toBeTruthy();
    expect(screen.getByText(/align to/i)).toBeTruthy();
  });

  it('shows Execute Align button when Align is active', async () => {
    const user = userEvent.setup();
    render(<GeometryToolsPanel isOpen onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /^align$/i }));
    expect(screen.getByRole('button', { name: /execute align/i })).toBeTruthy();
  });

  it('shows delta labels when Move is active', async () => {
    const user = userEvent.setup();
    render(<GeometryToolsPanel isOpen onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /^move$/i }));
    expect(screen.getByText(/\u0394x \(m\)/i)).toBeTruthy();
    expect(screen.getByText(/\u0394y \(m\)/i)).toBeTruthy();
    expect(screen.getByText(/\u0394z \(m\)/i)).toBeTruthy();
  });

  it('shows Execute Move button when Move is active', async () => {
    const user = userEvent.setup();
    render(<GeometryToolsPanel isOpen onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /^move$/i }));
    expect(screen.getByRole('button', { name: /execute move/i })).toBeTruthy();
  });
});
