/**
 * theme.ts - BeamLab Design System Tokens
 * 
 * Centralized design tokens for consistent styling across the application.
 * Use these instead of hardcoded colors to ensure UI consistency.
 */

// ============================================
// COLOR PALETTE
// ============================================

export const colors = {
    // Primary Brand Colors
    primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',  // Main primary color
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
        950: '#172554',
    },

    // Accent Colors (for CTAs, highlights)
    accent: {
        50: '#faf5ff',
        100: '#f3e8ff',
        200: '#e9d5ff',
        300: '#d8b4fe',
        400: '#c084fc',
        500: '#a855f7',  // Main accent color
        600: '#9333ea',
        700: '#7c3aed',
        800: '#6b21a8',
        900: '#581c87',
        950: '#3b0764',
    },

    // Success Colors
    success: {
        50: '#f0fdf4',
        100: '#dcfce7',
        200: '#bbf7d0',
        300: '#86efac',
        400: '#4ade80',
        500: '#22c55e',  // Main success color
        600: '#16a34a',
        700: '#15803d',
        800: '#166534',
        900: '#14532d',
        950: '#052e16',
    },

    // Warning Colors
    warning: {
        50: '#fffbeb',
        100: '#fef3c7',
        200: '#fde68a',
        300: '#fcd34d',
        400: '#fbbf24',
        500: '#f59e0b',  // Main warning color
        600: '#d97706',
        700: '#b45309',
        800: '#92400e',
        900: '#78350f',
        950: '#451a03',
    },

    // Error/Danger Colors
    error: {
        50: '#fef2f2',
        100: '#fee2e2',
        200: '#fecaca',
        300: '#fca5a5',
        400: '#f87171',
        500: '#ef4444',  // Main error color
        600: '#dc2626',
        700: '#b91c1c',
        800: '#991b1b',
        900: '#7f1d1d',
        950: '#450a0a',
    },

    // Neutral/Slate Colors (for backgrounds, text)
    neutral: {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a',
        950: '#020617',
    },

    // Special Engineering Colors
    steel: {
        light: '#78909C',
        medium: '#546E7A',
        dark: '#37474F',
    },

    concrete: {
        light: '#BDBDBD',
        medium: '#9E9E9E',
        dark: '#757575',
    },
} as const;

// ============================================
// SEMANTIC COLORS (Use these in components)
// ============================================

export const semanticColors = {
    // Backgrounds
    background: {
        primary: colors.neutral[950],    // Main app background
        secondary: colors.neutral[900],  // Cards, panels
        tertiary: colors.neutral[800],   // Elevated elements
        hover: colors.neutral[800],      // Hover states
        selected: colors.primary[900],   // Selected states
    },

    // Text Colors
    text: {
        primary: colors.neutral[100],    // Main text
        secondary: colors.neutral[300],  // Secondary text (Figma: #cbd5e1)
        muted: colors.neutral[400],      // Disabled/muted text (#94a3b8 per Figma §1.3)
        inverse: colors.neutral[900],    // Text on light backgrounds
        accent: colors.primary[400],     // Links, highlights
    },

    // Border Colors
    border: {
        default: colors.neutral[600],    // #475569 per Figma §1.3
        light: colors.neutral[700],
        focus: colors.primary[500],
        error: colors.error[500],
    },

    // Status Colors
    status: {
        draft: colors.neutral[500],
        analyzing: colors.primary[500],
        analyzed: colors.success[500],
        warning: colors.warning[500],
        error: colors.error[500],
        complete: colors.success[600],
    },

    // Analysis Result Colors
    analysis: {
        displacement: colors.primary[400],
        stress: colors.error[400],
        strain: colors.warning[400],
        force: colors.accent[400],
        moment: colors.success[400],
        shear: colors.error[500],
    },

    // Structural Element Colors (aligned with Figma spec)
    elements: {
        node: '#22d3ee',                 // Cyan (Figma: node-color)
        nodeSelected: colors.accent[500],
        member: colors.neutral[400],     // #94a3b8
        memberSelected: colors.primary[400],
        support: '#f59e0b',              // Gold (Figma: support-color)
        load: '#ef4444',                 // Red (Figma: load-color)
        selected: colors.primary[500],   // Blue (Figma: selected-color)
    },
} as const;

// ============================================
// TYPOGRAPHY
// ============================================

export const typography = {
    fontFamily: {
        sans: '"Inter", "Noto Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        mono: '"JetBrains Mono", "Fira Code", Consolas, monospace',
        display: '"Space Grotesk", "Inter", system-ui, sans-serif',
    },

    fontSize: {
        xs: '0.75rem',    // 12px
        sm: '0.875rem',   // 14px
        base: '1rem',     // 16px
        lg: '1.125rem',   // 18px
        xl: '1.25rem',    // 20px
        '2xl': '1.5rem',  // 24px
        '3xl': '1.875rem', // 30px
        '4xl': '2.25rem', // 36px
        '5xl': '3rem',    // 48px
    },

    fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
    },

    lineHeight: {
        tight: '1.25',
        snug: '1.35',
        normal: '1.5',
        relaxed: '1.75',
    },

    // Composite type presets (Figma spec)
    presets: {
        'display-xl': { size: '3rem', weight: '700', lineHeight: '1.1', letterSpacing: '-0.02em' },
        'display-lg': { size: '2.25rem', weight: '700', lineHeight: '1.15', letterSpacing: '-0.02em' },
        'display-md': { size: '1.875rem', weight: '600', lineHeight: '1.2', letterSpacing: '-0.01em' },
        h1: { size: '1.5rem', weight: '600', lineHeight: '1.3', letterSpacing: '-0.01em' },
        h2: { size: '1.25rem', weight: '600', lineHeight: '1.35', letterSpacing: '-0.01em' },
        h3: { size: '1.125rem', weight: '600', lineHeight: '1.4', letterSpacing: '-0.005em' },
        h4: { size: '1rem', weight: '600', lineHeight: '1.4', letterSpacing: '0' },
        h5: { size: '0.875rem', weight: '600', lineHeight: '1.4', letterSpacing: '0' },
        h6: { size: '0.75rem', weight: '600', lineHeight: '1.5', letterSpacing: '0.05em' },
        body: { size: '0.875rem', weight: '400', lineHeight: '1.5', letterSpacing: '0' },
        'body-sm': { size: '0.75rem', weight: '400', lineHeight: '1.5', letterSpacing: '0' },
        caption: { size: '0.6875rem', weight: '400', lineHeight: '1.4', letterSpacing: '0.01em' },
        code: { size: '0.75rem', weight: '400', lineHeight: '1.5', letterSpacing: '0' },
        label: { size: '0.75rem', weight: '500', lineHeight: '1.3', letterSpacing: '0.02em' },
        value: { size: '0.875rem', weight: '500', lineHeight: '1.3', letterSpacing: '0' },
        unit: { size: '0.625rem', weight: '400', lineHeight: '1.2', letterSpacing: '0.02em' },
        button: { size: '0.875rem', weight: '500', lineHeight: '1', letterSpacing: '0.01em' },
        'button-sm': { size: '0.75rem', weight: '500', lineHeight: '1', letterSpacing: '0.01em' },
        tab: { size: '0.8125rem', weight: '500', lineHeight: '1', letterSpacing: '0.01em' },
        menu: { size: '0.8125rem', weight: '400', lineHeight: '1.4', letterSpacing: '0' },
        tooltip: { size: '0.75rem', weight: '400', lineHeight: '1.4', letterSpacing: '0' },
        'status-bar': { size: '0.6875rem', weight: '400', lineHeight: '1', letterSpacing: '0' },
    },
} as const;

// ============================================
// SPACING
// ============================================

export const spacing = {
    px: '1px',
    0: '0',
    0.5: '0.125rem',  // 2px
    1: '0.25rem',     // 4px
    1.5: '0.375rem',  // 6px
    2: '0.5rem',      // 8px
    2.5: '0.625rem',  // 10px
    3: '0.75rem',     // 12px
    3.5: '0.875rem',  // 14px
    4: '1rem',        // 16px
    5: '1.25rem',     // 20px
    6: '1.5rem',      // 24px
    7: '1.75rem',     // 28px
    8: '2rem',        // 32px
    9: '2.25rem',     // 36px
    10: '2.5rem',     // 40px
    12: '3rem',       // 48px
    14: '3.5rem',     // 56px
    16: '4rem',       // 64px
    20: '5rem',       // 80px
    24: '6rem',       // 96px
} as const;

// ============================================
// BORDER RADIUS
// ============================================

export const borderRadius = {
    none: '0',
    sm: '0.25rem',    // 4px (Figma spec)
    default: '0.25rem', // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    '3xl': '1.5rem',  // 24px
    full: '9999px',
} as const;

// ============================================
// SHADOWS
// ============================================

export const shadows = {
    none: 'none',
    sm: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
    default: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)',
    lg: '0 10px 15px rgba(0,0,0,0.15), 0 4px 6px rgba(0,0,0,0.10)',
    xl: '0 20px 25px rgba(0,0,0,0.18), 0 8px 10px rgba(0,0,0,0.12)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px rgba(0,0,0,0.06)',
    // Figma §1.4 elevation aliases
    'elevation-1': '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
    'elevation-2': '0 4px 6px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)',
    'elevation-3': '0 10px 15px rgba(0,0,0,0.15), 0 4px 6px rgba(0,0,0,0.10)',
    'elevation-4': '0 20px 25px rgba(0,0,0,0.18), 0 8px 10px rgba(0,0,0,0.12)',
    glow: '0 0 20px rgba(59, 130, 246, 0.3)',
    glowAccent: '0 0 20px rgba(168, 85, 247, 0.3)',
    glowSuccess: '0 0 20px rgba(34, 197, 94, 0.3)',
    glowError: '0 0 20px rgba(239, 68, 68, 0.3)',
} as const;

// ============================================
// TRANSITIONS
// ============================================

export const transitions = {
    duration: {
        fast: '100ms',     // Figma spec: 100ms
        default: '200ms',
        slow: '300ms',
        slower: '500ms',
    },
    timing: {
        ease: 'ease',
        easeIn: 'ease-in',
        easeOut: 'ease-out',
        easeInOut: 'ease-in-out',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',  // Figma spec spring
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
} as const;

// ============================================
// Z-INDEX SCALE
// ============================================

export const zIndex = {
    hide: -1,
    base: 0,
    dropdown: 10,
    sticky: 20,
    overlay: 30,         // Figma: z-overlay
    modal: 40,           // Figma: z-modal = 40
    popover: 50,         // Figma: z-popover = 50
    toast: 60,           // Figma: z-toast = 60
    command: 70,         // Figma: z-command = 70
    tooltip: 80,
    max: 100,            // Figma: z-max = 100
} as const;

// ============================================
// BREAKPOINTS (for responsive design)
// ============================================

export const breakpoints = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    wide: '1440px',    // Figma: wide breakpoint
    '2xl': '1536px',
    ultra: '1920px',   // Figma: ultra breakpoint
} as const;

// ============================================
// COMPONENT-SPECIFIC TOKENS
// ============================================

export const components = {
    button: {
        primary: {
            bg: colors.primary[600],       // #2563eb per Figma §2.1
            bgHover: colors.primary[700],  // #1d4ed8 per Figma §2.1
            bgActive: colors.primary[800], // #1e40af per Figma §2.1
            text: 'white',
        },
        secondary: {
            bg: colors.neutral[800],
            bgHover: colors.neutral[700],
            text: colors.neutral[100],
        },
        danger: {
            bg: colors.error[600],
            bgHover: colors.error[700],
            text: 'white',
        },
        ghost: {
            bg: 'transparent',
            bgHover: colors.neutral[800],
            text: colors.neutral[300],
        },
    },

    input: {
        bg: colors.neutral[900],
        border: colors.neutral[700],
        borderFocus: colors.primary[500],
        text: colors.neutral[100],
        placeholder: colors.neutral[500],
    },

    card: {
        bg: colors.neutral[900],
        border: colors.neutral[800],
        borderHover: colors.primary[600] + '4D', // 30% opacity
    },

    tooltip: {
        bg: colors.neutral[800],
        text: colors.neutral[100],
        border: colors.neutral[700],
    },
} as const;

// ============================================
// CSS CUSTOM PROPERTIES GENERATOR
// ============================================

export const generateCSSVariables = (): string => {
    return `
:root {
    /* Primary Colors */
    --color-primary-500: ${colors.primary[500]};
    --color-primary-600: ${colors.primary[600]};
    --color-primary-700: ${colors.primary[700]};
    
    /* Accent Colors */
    --color-accent-500: ${colors.accent[500]};
    --color-accent-600: ${colors.accent[600]};
    
    /* Neutral Colors */
    --color-neutral-100: ${colors.neutral[100]};
    --color-neutral-400: ${colors.neutral[400]};
    --color-neutral-500: ${colors.neutral[500]};
    --color-neutral-700: ${colors.neutral[700]};
    --color-neutral-800: ${colors.neutral[800]};
    --color-neutral-900: ${colors.neutral[900]};
    --color-neutral-950: ${colors.neutral[950]};
    
    /* Status Colors */
    --color-success-500: ${colors.success[500]};
    --color-warning-500: ${colors.warning[500]};
    --color-error-500: ${colors.error[500]};
    
    /* Semantic Colors */
    --bg-primary: ${semanticColors.background.primary};
    --bg-secondary: ${semanticColors.background.secondary};
    --bg-tertiary: ${semanticColors.background.tertiary};
    
    --text-primary: ${semanticColors.text.primary};
    --text-secondary: ${semanticColors.text.secondary};
    --text-muted: ${semanticColors.text.muted};
    
    --border-default: ${semanticColors.border.default};
    --border-focus: ${semanticColors.border.focus};
    
    /* Typography */
    --font-sans: ${typography.fontFamily.sans};
    --font-mono: ${typography.fontFamily.mono};
    
    /* Transitions */
    --transition-fast: ${transitions.duration.fast};
    --transition-default: ${transitions.duration.default};
}
`;
};

// Default export for convenience
const theme = {
    colors,
    semanticColors,
    typography,
    spacing,
    borderRadius,
    shadows,
    transitions,
    zIndex,
    breakpoints,
    components,
    generateCSSVariables,
};

export default theme;
