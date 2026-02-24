/**
 * Test Utilities
 * Industry-standard test helper functions
 * 
 * Features:
 * - Custom render with providers
 * - Accessibility testing helpers
 * - User event helpers
 * - Wait utilities
 * - Mock generators
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// Provider Wrapper
// ============================================================================

interface WrapperProps {
  children: ReactNode;
}

function AllTheProviders({ children }: WrapperProps): ReactElement {
  // Add all your app providers here
  return (
    <React.Fragment>
      {children}
    </React.Fragment>
  );
}

// ============================================================================
// Custom Render
// ============================================================================

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
  initialState?: Record<string, unknown>;
}

function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  // Set up route if specified
  if (options?.route) {
    window.history.pushState({}, 'Test page', options.route);
  }

  const user = userEvent.setup();
  
  return {
    user,
    ...render(ui, { wrapper: AllTheProviders, ...options }),
  };
}

// ============================================================================
// Accessibility Testing
// ============================================================================

/**
 * Check for accessibility violations using axe-core
 */
export async function checkA11y(container: HTMLElement): Promise<void> {
  const axe = await import('axe-core');
  const results = await axe.default.run(container);
  
  expect(results).toHaveNoViolations();
}

// ============================================================================
// Wait Utilities
// ============================================================================

/**
 * Wait for element to be removed from DOM
 */
export async function waitForElementToBeRemoved(
  callback: () => HTMLElement | null
): Promise<void> {
  await waitFor(() => {
    expect(callback()).toBeNull();
  });
}

/**
 * Wait for loading to complete
 */
export async function waitForLoadingToComplete(): Promise<void> {
  const loadingElements = screen.queryAllByTestId('loading');
  
  for (const element of loadingElements) {
    await waitFor(() => {
      expect(element).not.toBeInTheDocument();
    });
  }
}

/**
 * Wait for network idle
 */
export function waitForNetworkIdle(timeout = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

// ============================================================================
// Mock Generators
// ============================================================================

let idCounter = 0;

/**
 * Generate a unique ID for testing
 */
export function generateId(prefix = 'test'): string {
  return `${prefix}-${++idCounter}-${Date.now()}`;
}

/**
 * Generate a mock user
 */
export function generateMockUser(overrides = {}): Record<string, unknown> {
  return {
    id: generateId('user'),
    email: `test-${idCounter}@example.com`,
    name: `Test User ${idCounter}`,
    role: 'engineer',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Generate a mock project
 */
export function generateMockProject(overrides = {}): Record<string, unknown> {
  return {
    id: generateId('project'),
    name: `Test Project ${idCounter}`,
    description: 'A test project',
    status: 'active',
    ownerId: generateId('user'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Generate a mock analysis
 */
export function generateMockAnalysis(overrides = {}): Record<string, unknown> {
  return {
    id: generateId('analysis'),
    projectId: generateId('project'),
    type: 'beam',
    status: 'completed',
    results: {
      maxMoment: Math.random() * 500,
      maxShear: Math.random() * 200,
      deflection: Math.random() * 20,
      utilizationRatio: Math.random(),
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Event Helpers
// ============================================================================

/**
 * Type text into an input
 */
export async function typeIntoInput(
  user: ReturnType<typeof userEvent.setup>,
  element: HTMLElement,
  text: string
): Promise<void> {
  await user.clear(element);
  await user.type(element, text);
}

/**
 * Select an option from a select element
 */
export async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  selectElement: HTMLElement,
  optionText: string
): Promise<void> {
  await user.click(selectElement);
  const option = await screen.findByRole('option', { name: optionText });
  await user.click(option);
}

/**
 * Submit a form
 */
export async function submitForm(
  user: ReturnType<typeof userEvent.setup>,
  formElement?: HTMLElement
): Promise<void> {
  if (formElement) {
    const submitButton = formElement.querySelector('[type="submit"]');
    if (submitButton) {
      await user.click(submitButton as HTMLElement);
    }
  } else {
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);
  }
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert element is visible
 */
export function assertVisible(element: HTMLElement): void {
  expect(element).toBeVisible();
}

/**
 * Assert element has text content
 */
export function assertText(element: HTMLElement, text: string | RegExp): void {
  if (typeof text === 'string') {
    expect(element).toHaveTextContent(text);
  } else {
    expect(element.textContent).toMatch(text);
  }
}

/**
 * Assert form field has error
 */
export function assertFieldError(fieldName: string, errorMessage: string): void {
  const errorElement = screen.getByTestId(`${fieldName}-error`);
  expect(errorElement).toHaveTextContent(errorMessage);
}

// ============================================================================
// Re-exports
// ============================================================================

export * from '@testing-library/react';
export { userEvent };
export { customRender as render };
