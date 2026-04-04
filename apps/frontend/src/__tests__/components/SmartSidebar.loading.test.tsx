/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock react-router-dom to avoid ESM/CJS resolution issues in vmForks pool
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) => React.createElement('a', { href: to, ...props }, children),
  MemoryRouter: ({ children }: any) => React.createElement(React.Fragment, null, children),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'default' }),
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  NavLink: ({ children, to, ...props }: any) => React.createElement('a', { href: to, ...props }, children),
  Outlet: () => null,
  Routes: ({ children }: any) => React.createElement(React.Fragment, null, children),
  Route: () => null,
  BrowserRouter: ({ children }: any) => React.createElement(React.Fragment, null, children),
}));

import { SmartSidebar } from '../../components/layout/SmartSidebar';
import { useUIStore } from '../../store/uiStore';
import { useModelStore } from '../../store/model';

describe('SmartSidebar loading panels', () => {
  beforeEach(() => {
    useUIStore.getState().resetToDefaults();
    useModelStore.getState().clearModel();
    useUIStore.getState().setCategory('LOADING');
  });

  afterEach(() => {
    cleanup();
    useUIStore.getState().resetToDefaults();
    useModelStore.getState().clearModel();
  });

  it('shows Load Cases panel in LOADING category', () => {
    render(<SmartSidebar />);

    expect(screen.getByRole('button', { name: /load cases/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /add load case/i })).toBeTruthy();
  });

  it('creates a new load case from the sidebar manager', async () => {
    const user = userEvent.setup();
    render(<SmartSidebar />);

    await user.type(screen.getByPlaceholderText(/case name/i), 'DL - Dead Load');
    await user.click(screen.getByRole('button', { name: /add load case/i }));

    const hasCreated = useModelStore
      .getState()
      .loadCases.some((lc) => lc.name === 'DL - Dead Load');
    expect(hasCreated).toBe(true);
  });

  it('updates Active Load Case card after creating a load case', async () => {
    const user = userEvent.setup();
    render(<SmartSidebar />);

    await user.type(screen.getByPlaceholderText(/case name/i), 'LL - Live Load');
    await user.click(screen.getByRole('button', { name: /add load case/i }));

    expect(screen.getByText(/active load case/i)).toBeTruthy();

    const state = useModelStore.getState();
    const activeId = state.activeLoadCaseId;
    const active = state.loadCases.find((lc) => lc.id === activeId);
    expect(active?.name).toBe('LL - Live Load');
  });

  it('applies nodal load to selected node via manual loads panel', async () => {
    const user = userEvent.setup();

    useModelStore.getState().addNode({ id: 'N1', x: 0, y: 0, z: 0 });
    useModelStore.getState().select('N1', false);

    render(<SmartSidebar />);

    await user.click(screen.getByRole('button', { name: /apply to selected node\(s\)/i }));

    const loads = useModelStore.getState().loads;
    expect(loads.some((l) => l.nodeId === 'N1')).toBe(true);
  });

  it('applies UDL to selected member via manual loads panel', async () => {
    const user = userEvent.setup();

    useModelStore.getState().addNode({ id: 'N1', x: 0, y: 0, z: 0 });
    useModelStore.getState().addNode({ id: 'N2', x: 5, y: 0, z: 0 });
    useModelStore.getState().addMember({ id: 'M1', startNodeId: 'N1', endNodeId: 'N2' });
    useModelStore.getState().select('M1', false);

    render(<SmartSidebar />);

    await user.click(screen.getByRole('button', { name: /apply udl/i }));

    const memberLoads = useModelStore.getState().memberLoads;
    expect(memberLoads.some((l) => l.memberId === 'M1' && l.type === 'UDL')).toBe(true);
  });
});
