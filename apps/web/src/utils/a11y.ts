/**
 * ============================================================================
 * ACCESSIBILITY UTILITIES
 * ============================================================================
 * 
 * Helper functions and constants for improving accessibility across the app.
 * 
 * @version 1.0.0
 */

/**
 * ARIA live region announcer for screen readers
 * Useful for dynamic content updates that need to be announced
 */
export class AriaAnnouncer {
    private container: HTMLDivElement | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            this.initialize();
        }
    }

    private initialize(): void {
        // Create live region container
        this.container = document.createElement('div');
        this.container.setAttribute('role', 'status');
        this.container.setAttribute('aria-live', 'polite');
        this.container.setAttribute('aria-atomic', 'true');
        this.container.className = 'sr-only'; // Visually hidden but accessible
        document.body.appendChild(this.container);
    }

    /**
     * Announce a message to screen readers
     */
    announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
        if (!this.container) return;

        this.container.setAttribute('aria-live', priority);
        this.container.textContent = message;

        // Clear after announcement
        setTimeout(() => {
            if (this.container) {
                this.container.textContent = '';
            }
        }, 1000);
    }
}

// Global announcer instance
export const announcer = new AriaAnnouncer();

/**
 * Generate accessible ID for form elements
 */
export function generateA11yId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Focus trap for modals and dialogs
 */
export function trapFocus(element: HTMLElement): () => void {
    const focusableElements = element.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement?.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement?.focus();
            }
        }
    };

    element.addEventListener('keydown', handleTabKey);

    // Return cleanup function
    return () => {
        element.removeEventListener('keydown', handleTabKey);
    };
}

/**
 * Keyboard navigation helper
 */
export const KEYBOARD = {
    ENTER: 'Enter',
    SPACE: ' ',
    ESCAPE: 'Escape',
    ARROW_UP: 'ArrowUp',
    ARROW_DOWN: 'ArrowDown',
    ARROW_LEFT: 'ArrowLeft',
    ARROW_RIGHT: 'ArrowRight',
    TAB: 'Tab',
    HOME: 'Home',
    END: 'End',
} as const;

/**
 * Check if an element is an interactive element
 */
export function isInteractive(element: HTMLElement): boolean {
    const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
    return (
        interactiveTags.includes(element.tagName) ||
        element.hasAttribute('tabindex') ||
        element.hasAttribute('contenteditable')
    );
}

/**
 * Add keyboard support to clickable elements
 */
export function makeKeyboardAccessible(
    element: HTMLElement,
    onClick: (e: Event) => void
): () => void {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === KEYBOARD.ENTER || e.key === KEYBOARD.SPACE) {
            e.preventDefault();
            onClick(e);
        }
    };

    element.addEventListener('keydown', handleKeyDown);
    element.setAttribute('tabindex', '0');
    if (!element.hasAttribute('role')) {
        element.setAttribute('role', 'button');
    }

    // Return cleanup function
    return () => {
        element.removeEventListener('keydown', handleKeyDown);
    };
}

/**
 * Skip link component data (for main content navigation)
 */
export const SKIP_LINKS = {
    mainContent: 'main-content',
    navigation: 'main-navigation',
    search: 'search',
} as const;

/**
 * Screen reader only styles
 * Use this class for visually hidden but accessible content
 */
export const SR_ONLY_STYLES = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: '0',
} as const;
