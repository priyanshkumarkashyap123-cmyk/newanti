/**
 * Unit tests for the ErrorBoundary component
 * 
 * Verifies that the ErrorBoundary:
 * - Renders children when there is no error
 * - Catches errors and shows fallback UI
 * - Calls onError callback when provided
 * - Shows retry and clear buttons
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../../components/ErrorBoundary';

// Component that throws on render
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) {
        throw new Error('Test error');
    }
    return <div data-testid="child">Child content</div>;
}

describe('ErrorBoundary', () => {
    // Suppress console.error for expected errors in tests
    const originalConsoleError = console.error;
    beforeEach(() => {
        console.error = vi.fn();
    });
    afterEach(() => {
        console.error = originalConsoleError;
    });

    it('should render children when there is no error', () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={false} />
            </ErrorBoundary>
        );

        expect(screen.getByTestId('child')).toBeDefined();
        expect(screen.getByText('Child content')).toBeDefined();
    });

    it('should show error UI when child throws', () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText(/Something went wrong/)).toBeDefined();
        expect(screen.getByText(/Test error/)).toBeDefined();
    });

    it('should call onError callback when provided', () => {
        const onError = vi.fn();

        render(
            <ErrorBoundary onError={onError}>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({ componentStack: expect.any(String) })
        );
    });

    it('should render custom fallback when provided', () => {
        const fallback = <div data-testid="custom-fallback">Custom fallback</div>;

        render(
            <ErrorBoundary fallback={fallback}>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByTestId('custom-fallback')).toBeDefined();
        expect(screen.getByText('Custom fallback')).toBeDefined();
    });

    it('should show retry and clear buttons', () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText(/Try Again/)).toBeDefined();
        expect(screen.getByText(/Clear & Restart/)).toBeDefined();
    });

    it('should show export error report button', () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText(/Export Error Report/)).toBeDefined();
    });
});
