/**
 * Smoke test: Room Planner navigation wiring
 *
 * Verifies Feature Navigation exposes Room Planner and routes to /room-planner.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) => React.createElement('a', { href: to, ...props }, children),
  useNavigate: () => navigateMock,
}));

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: any) => React.createElement('button', props, children),
    div: ({ children, ...props }: any) => React.createElement('div', props, children),
  },
  AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
}));

vi.mock('../../utils/routePrefetch', () => ({
  prefetchRoute: vi.fn(),
  prefetchRoutes: vi.fn(),
}));

import { FeatureNavigation } from '../../components/navigation/FeatureNavigation';

describe('Room Planner route smoke', () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it('shows Room Planner and navigates to /room-planner when clicked', () => {
    render(<FeatureNavigation searchable={true} />);

    const roomPlanner = screen.getByRole('button', { name: /room planner/i });
    expect(roomPlanner).toBeDefined();

    fireEvent.click(roomPlanner);
    expect(navigateMock).toHaveBeenCalledWith('/room-planner');
  });
});
