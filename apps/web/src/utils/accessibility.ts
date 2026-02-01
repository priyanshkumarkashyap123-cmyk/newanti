/**
 * Accessibility Utilities for BeamLab
 * 
 * Provides WCAG AA compliant utilities for:
 * - Focus management
 * - ARIA announcements
 * - Keyboard navigation
 * - Reduced motion detection
 */

// ============================================
// ARIA LIVE ANNOUNCER
// ============================================

let announcer: HTMLDivElement | null = null;

/**
 * Initialize the ARIA live region for screen reader announcements
 */
export function initAriaAnnouncer(): void {
    if (typeof document === 'undefined') return;
    if (announcer) return;

    announcer = document.createElement('div');
    announcer.id = 'aria-announcer';
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.style.cssText = `
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    `;
    document.body.appendChild(announcer);
}

/**
 * Announce a message to screen readers
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!announcer) initAriaAnnouncer();
    if (!announcer) return;

    announcer.setAttribute('aria-live', priority);
    announcer.textContent = '';
    
    // Small delay to ensure screen readers pick up the change
    requestAnimationFrame(() => {
        if (announcer) {
            announcer.textContent = message;
        }
    });
}

// ============================================
// FOCUS MANAGEMENT
// ============================================

const focusableSelectors = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
}

/**
 * Trap focus within a container (for modals/dialogs)
 */
export function trapFocus(container: HTMLElement): () => void {
    const focusable = getFocusableElements(container);
    if (focusable.length === 0) return () => {};

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    };

    container.addEventListener('keydown', handleKeyDown);
    first.focus();

    return () => {
        container.removeEventListener('keydown', handleKeyDown);
    };
}

/**
 * Restore focus to a previously focused element
 */
export function createFocusRestorer(): () => void {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    
    return () => {
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
            previouslyFocused.focus();
        }
    };
}

// ============================================
// REDUCED MOTION
// ============================================

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Listen for reduced motion preference changes
 */
export function onReducedMotionChange(callback: (prefersReduced: boolean) => void): () => void {
    if (typeof window === 'undefined') return () => {};
    
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => callback(e.matches);
    
    mediaQuery.addEventListener('change', handler);
    callback(mediaQuery.matches);
    
    return () => mediaQuery.removeEventListener('change', handler);
}

// ============================================
// KEYBOARD NAVIGATION HELPERS
// ============================================

export interface KeyboardShortcut {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    description: string;
    action: () => void;
}

/**
 * Create a keyboard shortcut handler
 */
export function createKeyboardHandler(shortcuts: KeyboardShortcut[]): (e: KeyboardEvent) => void {
    return (e: KeyboardEvent) => {
        for (const shortcut of shortcuts) {
            const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
            const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
            const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
            const altMatch = shortcut.alt ? e.altKey : !e.altKey;

            if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                e.preventDefault();
                shortcut.action();
                announce(`${shortcut.description}`);
                return;
            }
        }
    };
}

// ============================================
// COLOR CONTRAST CHECK
// ============================================

/**
 * Calculate relative luminance of a color
 */
function getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * Returns a value between 1 and 21
 */
export function getContrastRatio(
    color1: { r: number; g: number; b: number },
    color2: { r: number; g: number; b: number }
): number {
    const l1 = getLuminance(color1.r, color1.g, color1.b);
    const l2 = getLuminance(color2.r, color2.g, color2.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG AA standard
 * Normal text: 4.5:1, Large text: 3:1
 */
export function meetsContrastAA(
    foreground: { r: number; g: number; b: number },
    background: { r: number; g: number; b: number },
    isLargeText = false
): boolean {
    const ratio = getContrastRatio(foreground, background);
    return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

// ============================================
// EXPORT HELPERS FOR REACT
// ============================================

/**
 * ARIA props for interactive elements
 */
export function getButtonAriaProps(label: string, isPressed?: boolean, isDisabled?: boolean) {
    return {
        role: 'button',
        'aria-label': label,
        'aria-pressed': isPressed,
        'aria-disabled': isDisabled,
        tabIndex: isDisabled ? -1 : 0,
    };
}

/**
 * ARIA props for 3D canvas region
 */
export function getCanvasAriaProps(modelInfo: { nodes: number; members: number }) {
    return {
        role: 'application',
        'aria-label': `3D structural model viewer with ${modelInfo.nodes} nodes and ${modelInfo.members} members`,
        'aria-roledescription': 'interactive 3D canvas',
        tabIndex: 0,
    };
}

/**
 * ARIA props for loading states
 */
export function getLoadingAriaProps(isLoading: boolean, loadingMessage = 'Loading...') {
    return {
        'aria-busy': isLoading,
        'aria-live': 'polite' as const,
        ...(isLoading && { 'aria-label': loadingMessage }),
    };
}

// ============================================
// ENHANCED FOCUS MANAGEMENT HOOKS
// ============================================

/**
 * Hook for managing focus trap in modals/dialogs
 * Returns a ref to attach to the container element
 */
export function useFocusTrap(isActive: boolean = true) {
    const containerRef = { current: null as HTMLElement | null };
    const previousFocusRef = { current: null as HTMLElement | null };
    
    // Setup effect
    if (typeof window !== 'undefined' && isActive && containerRef.current) {
        previousFocusRef.current = document.activeElement as HTMLElement;
        const cleanup = trapFocus(containerRef.current);
        
        // Return cleanup that also restores focus
        return {
            containerRef,
            cleanup: () => {
                cleanup();
                previousFocusRef.current?.focus();
            }
        };
    }
    
    return { containerRef, cleanup: () => {} };
}

/**
 * Roving tabindex for toolbar/menu navigation
 */
export function createRovingTabIndex(container: HTMLElement, selector: string) {
    const items = Array.from(container.querySelectorAll<HTMLElement>(selector));
    let activeIndex = 0;
    
    // Set initial tabindex
    items.forEach((item, i) => {
        item.setAttribute('tabindex', i === 0 ? '0' : '-1');
    });
    
    const handleKeyDown = (e: KeyboardEvent) => {
        const currentIndex = items.findIndex(item => item === document.activeElement);
        if (currentIndex === -1) return;
        
        let newIndex = currentIndex;
        
        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                e.preventDefault();
                newIndex = (currentIndex + 1) % items.length;
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                e.preventDefault();
                newIndex = (currentIndex - 1 + items.length) % items.length;
                break;
            case 'Home':
                e.preventDefault();
                newIndex = 0;
                break;
            case 'End':
                e.preventDefault();
                newIndex = items.length - 1;
                break;
            default:
                return;
        }
        
        items[currentIndex].setAttribute('tabindex', '-1');
        items[newIndex].setAttribute('tabindex', '0');
        items[newIndex].focus();
        activeIndex = newIndex;
    };
    
    container.addEventListener('keydown', handleKeyDown);
    
    return () => container.removeEventListener('keydown', handleKeyDown);
}

// ============================================
// SKIP LINK UTILITY
// ============================================

/**
 * Create skip link for keyboard users
 */
export function createSkipLink(targetId: string = 'main-content', label: string = 'Skip to main content') {
    if (typeof document === 'undefined') return;
    
    const existingLink = document.getElementById('skip-link');
    if (existingLink) return;
    
    const skipLink = document.createElement('a');
    skipLink.id = 'skip-link';
    skipLink.href = `#${targetId}`;
    skipLink.textContent = label;
    skipLink.className = `
        sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
        focus:z-[9999] focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 
        focus:rounded-lg focus:shadow-lg focus:outline-none
    `.trim().replace(/\s+/g, ' ');
    
    skipLink.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(targetId);
        if (target) {
            target.tabIndex = -1;
            target.focus();
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
    
    document.body.insertBefore(skipLink, document.body.firstChild);
}

// ============================================
// LOADING STATE ANNOUNCER
// ============================================

/**
 * Announce loading state changes to screen readers
 */
export function announceLoadingState(
    isLoading: boolean,
    messages: { loading?: string; complete?: string; error?: string } = {}
) {
    const { 
        loading = 'Loading, please wait...', 
        complete = 'Content loaded successfully' 
    } = messages;
    
    if (isLoading) {
        announce(loading);
    } else {
        announce(complete);
    }
}

// ============================================
// UNIQUE ID GENERATOR FOR ARIA
// ============================================

let idCounter = 0;

/**
 * Generate unique ID for ARIA relationships
 */
export function generateAriaId(prefix: string = 'aria'): string {
    return `${prefix}-${++idCounter}-${Date.now().toString(36)}`;
}

/**
 * Create linked ARIA IDs for label/describedby relationships
 */
export function createAriaLinkage(prefix: string = 'field') {
    const id = generateAriaId(prefix);
    return {
        inputId: id,
        labelId: `${id}-label`,
        descriptionId: `${id}-desc`,
        errorId: `${id}-error`,
    };
}

