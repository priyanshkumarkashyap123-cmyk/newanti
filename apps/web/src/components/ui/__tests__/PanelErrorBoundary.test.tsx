/**
 * Tests for PanelErrorBoundary — Task 21: Error Boundaries and Resilience
 * Feature: beamlab-platform-refinement
 * Requirements: 16.1, 16.2, 16.3
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PanelErrorBoundary, CanvasFallback, PanelFallback } from '../PanelErrorBoundary';

// Suppress console.error for expected error boundary output
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ============================================
// HELPER: Component that throws on render
// ============================================

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test render error');
  }
  return <div data-testid="content">Content rendered successfully</div>;
}

// ============================================
// TESTS
// ============================================

describe('PanelErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <PanelErrorBoundary fallback={<div>Fallback</div>}>
        <ThrowingComponent shouldThrow={false} />
      </PanelErrorBoundary>
    );
    expect(screen.getByTestId('content')).toBeTruthy();
    expect(screen.queryByText('Fallback')).toBeNull();
  });

  it('renders fallback when child throws an uncaught exception (Req 16.1, 16.2, 16.3)', () => {
    render(
      <PanelErrorBoundary fallback={<div data-testid="fallback">Fallback UI</div>}>
        <ThrowingComponent shouldThrow={true} />
      </PanelErrorBoundary>
    );
    expect(screen.getByTestId('fallback')).toBeTruthy();
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('does not crash the rest of the application when child throws', () => {
    render(
      <div>
        <div data-testid="outside">Outside content</div>
        <PanelErrorBoundary fallback={<div>Fallback</div>}>
          <ThrowingComponent shouldThrow={true} />
        </PanelErrorBoundary>
      </div>
    );
    // Outside content must still render
    expect(screen.getByTestId('outside')).toBeTruthy();
  });
});

describe('CanvasFallback', () => {
  it('renders "Reload Canvas" button (Req 16.1)', () => {
    const onReload = vi.fn();
    render(<CanvasFallback onReload={onReload} />);
    const btn = screen.getByRole('button', { name: /reload canvas/i });
    expect(btn).toBeTruthy();
  });

  it('calls onReload when "Reload Canvas" is clicked', () => {
    const onReload = vi.fn();
    render(<CanvasFallback onReload={onReload} />);
    fireEvent.click(screen.getByRole('button', { name: /reload canvas/i }));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it('shows descriptive error message for 3D canvas', () => {
    render(<CanvasFallback onReload={() => {}} />);
    expect(screen.getByText(/3d canvas error/i)).toBeTruthy();
  });
});

describe('PanelFallback', () => {
  it('renders panel name in error message (Req 16.2)', () => {
    render(<PanelFallback name="Analysis & Design" />);
    expect(screen.getByText(/analysis & design error/i)).toBeTruthy();
  });

  it('renders a reload button', () => {
    render(<PanelFallback name="AI Architect" />);
    const btn = screen.getByRole('button', { name: /reload page/i });
    expect(btn).toBeTruthy();
  });
});

describe('PanelErrorBoundary with CanvasFallback (Req 16.1)', () => {
  it('shows "Reload Canvas" fallback when Three.js canvas throws', () => {
    const onReload = vi.fn();
    render(
      <PanelErrorBoundary fallback={<CanvasFallback onReload={onReload} />}>
        <ThrowingComponent shouldThrow={true} />
      </PanelErrorBoundary>
    );
    expect(screen.getByRole('button', { name: /reload canvas/i })).toBeTruthy();
  });
});

describe('PanelErrorBoundary with PanelFallback (Req 16.2)', () => {
  it('shows panel fallback when AnalysisDesignPanel throws', () => {
    render(
      <PanelErrorBoundary fallback={<PanelFallback name="Analysis & Design" />}>
        <ThrowingComponent shouldThrow={true} />
      </PanelErrorBoundary>
    );
    expect(screen.getByText(/analysis & design error/i)).toBeTruthy();
  });

  it('shows panel fallback when AIArchitectPanel throws', () => {
    render(
      <PanelErrorBoundary fallback={<PanelFallback name="AI Architect" />}>
        <ThrowingComponent shouldThrow={true} />
      </PanelErrorBoundary>
    );
    expect(screen.getByText(/ai architect error/i)).toBeTruthy();
  });
});

describe('SpacePlanningPage child panel error boundary (Req 16.3)', () => {
  it('shows "Reload" button in PanelFallback for space planning panels', () => {
    render(
      <PanelErrorBoundary fallback={<PanelFallback name="Floor Plan" />}>
        <ThrowingComponent shouldThrow={true} />
      </PanelErrorBoundary>
    );
    // PanelFallback renders a "Reload Page" button
    expect(screen.getByRole('button', { name: /reload page/i })).toBeTruthy();
  });
});
