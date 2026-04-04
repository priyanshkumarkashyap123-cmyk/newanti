/**
 * Room planner placement UX tests
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InteractiveRoomPlanner } from '../../components/room-planner/InteractiveRoomPlanner';

beforeAll(() => {
  // Minimal canvas context mock for jsdom
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: () => ({
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      lineCap: 'round',
      lineJoin: 'round',
      font: '12px Arial',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      setLineDash: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      closePath: vi.fn(),
      arc: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      fillText: vi.fn(),
    }),
  });
});

describe('InteractiveRoomPlanner placement UX', () => {
  it('shows pending placement hint', () => {
    render(<InteractiveRoomPlanner pendingFurnitureType="sofa" />);

    expect(screen.getByText(/click canvas to place/i)).toBeDefined();
    expect(screen.getByText(/sofa/i)).toBeDefined();
  });

  it('calls onPlacementCancel when Escape is pressed in placement mode', () => {
    const onPlacementCancel = vi.fn();
    render(
      <InteractiveRoomPlanner
        pendingFurnitureType="sofa"
        onPlacementCancel={onPlacementCancel}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onPlacementCancel).toHaveBeenCalledTimes(1);
  });
});
