/**
 * Test Setup Configuration
 * Industry-standard test configuration for Vitest
 * 
 * Features:
 * - MSW integration
 * - React Testing Library setup
 * - Custom matchers
 * - Global test utilities
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { server } from '../src/mocks/server';

// ============================================================================
// MSW Setup
// ============================================================================

beforeAll(() => {
  // Start MSW server
  server.listen({
    onUnhandledRequest: 'warn',
  });
});

afterEach(() => {
  // Reset handlers between tests
  server.resetHandlers();
  // Cleanup React Testing Library
  cleanup();
});

afterAll(() => {
  // Close MSW server
  server.close();
});

// ============================================================================
// Global Mocks
// ============================================================================

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// Mock scrollTo
window.scrollTo = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// ============================================================================
// Console Suppression
// ============================================================================

// Suppress specific console warnings during tests
const originalError = console.error;
console.error = (...args) => {
  // Ignore React 18 hydration warnings in tests
  if (args[0]?.includes?.('Warning: ReactDOM.render is no longer supported')) {
    return;
  }
  // Ignore act warnings
  if (args[0]?.includes?.('Warning: An update to')) {
    return;
  }
  originalError.call(console, ...args);
};

// ============================================================================
// Custom Test Matchers
// ============================================================================

expect.extend({
  toHaveNoViolations(received) {
    if (received.violations && received.violations.length === 0) {
      return {
        pass: true,
        message: () => 'Expected accessibility violations, but none found',
      };
    }
    
    const violations = received.violations || [];
    const message = violations
      .map((v: { id: string; description: string; nodes: { html: string }[] }) => 
        `${v.id}: ${v.description}\n  Elements: ${v.nodes.map(n => n.html).join(', ')}`
      )
      .join('\n\n');
    
    return {
      pass: false,
      message: () => `Found ${violations.length} accessibility violations:\n\n${message}`,
    };
  },
});
