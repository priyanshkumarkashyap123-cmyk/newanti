/**
 * ============================================================================
 * THEME PROVIDER - STRUCTURAL ENGINEERING UI
 * ============================================================================
 * 
 * Centralized theme management with dark/light mode support,
 * CSS variable integration, and design tokens.
 * 
 * @version 1.0.0
 */


import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type Theme = 'dark' | 'light' | 'system';
type AccentColor = 'blue' | 'emerald' | 'purple' | 'amber' | 'rose';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  accentColor: AccentColor;
  setTheme: (theme: Theme) => void;
  setAccentColor: (color: AccentColor) => void;
  colors: ThemeColors;
}

interface ThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceHover: string;
  border: string;
  text: string;
  textMuted: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

// =============================================================================
// COLOR PALETTES
// =============================================================================

const ACCENT_PALETTES: Record<AccentColor, { light: ThemeColors; dark: ThemeColors }> = {
  blue: {
    dark: {
      primary: '#3b82f6',
      primaryLight: '#60a5fa',
      primaryDark: '#2563eb',
      secondary: '#06b6d4',
      accent: '#f4e225',
      background: '#0f172a',
      surface: '#1e293b',
      surfaceHover: '#334155',
      border: '#475569',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
    light: {
      primary: '#2563eb',
      primaryLight: '#3b82f6',
      primaryDark: '#1d4ed8',
      secondary: '#0891b2',
      accent: '#d4a800',
      background: '#f8fafc',
      surface: '#ffffff',
      surfaceHover: '#f1f5f9',
      border: '#e2e8f0',
      text: '#0f172a',
      textMuted: '#64748b',
      success: '#059669',
      warning: '#d97706',
      error: '#dc2626',
      info: '#2563eb',
    },
  },
  emerald: {
    dark: {
      primary: '#10b981',
      primaryLight: '#34d399',
      primaryDark: '#059669',
      secondary: '#06b6d4',
      accent: '#f4e225',
      background: '#0a1f1c',
      surface: '#134e4a',
      surfaceHover: '#1e6259',
      border: '#2d7d74',
      text: '#f8fafc',
      textMuted: '#99d4cc',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#06b6d4',
    },
    light: {
      primary: '#059669',
      primaryLight: '#10b981',
      primaryDark: '#047857',
      secondary: '#0891b2',
      accent: '#d4a800',
      background: '#f0fdf4',
      surface: '#ffffff',
      surfaceHover: '#ecfdf5',
      border: '#bbf7d0',
      text: '#022c22',
      textMuted: '#4d7c6f',
      success: '#059669',
      warning: '#d97706',
      error: '#dc2626',
      info: '#0891b2',
    },
  },
  purple: {
    dark: {
      primary: '#8b5cf6',
      primaryLight: '#a78bfa',
      primaryDark: '#7c3aed',
      secondary: '#ec4899',
      accent: '#f4e225',
      background: '#1a0a2e',
      surface: '#2e1065',
      surfaceHover: '#4c1d95',
      border: '#6b21a8',
      text: '#f8fafc',
      textMuted: '#c4b5fd',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#8b5cf6',
    },
    light: {
      primary: '#7c3aed',
      primaryLight: '#8b5cf6',
      primaryDark: '#6d28d9',
      secondary: '#db2777',
      accent: '#d4a800',
      background: '#faf5ff',
      surface: '#ffffff',
      surfaceHover: '#f5f3ff',
      border: '#e9d5ff',
      text: '#1e1a3c',
      textMuted: '#7e6daf',
      success: '#059669',
      warning: '#d97706',
      error: '#dc2626',
      info: '#7c3aed',
    },
  },
  amber: {
    dark: {
      primary: '#f59e0b',
      primaryLight: '#fbbf24',
      primaryDark: '#d97706',
      secondary: '#ef4444',
      accent: '#3b82f6',
      background: '#1c1410',
      surface: '#451a03',
      surfaceHover: '#78350f',
      border: '#92400e',
      text: '#f8fafc',
      textMuted: '#fcd34d',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
    light: {
      primary: '#d97706',
      primaryLight: '#f59e0b',
      primaryDark: '#b45309',
      secondary: '#dc2626',
      accent: '#2563eb',
      background: '#fffbeb',
      surface: '#ffffff',
      surfaceHover: '#fef3c7',
      border: '#fde68a',
      text: '#451a03',
      textMuted: '#a16207',
      success: '#059669',
      warning: '#d97706',
      error: '#dc2626',
      info: '#2563eb',
    },
  },
  rose: {
    dark: {
      primary: '#f43f5e',
      primaryLight: '#fb7185',
      primaryDark: '#e11d48',
      secondary: '#8b5cf6',
      accent: '#f4e225',
      background: '#1c0a14',
      surface: '#4c0519',
      surfaceHover: '#881337',
      border: '#9f1239',
      text: '#f8fafc',
      textMuted: '#fda4af',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#8b5cf6',
    },
    light: {
      primary: '#e11d48',
      primaryLight: '#f43f5e',
      primaryDark: '#be123c',
      secondary: '#7c3aed',
      accent: '#d4a800',
      background: '#fff1f2',
      surface: '#ffffff',
      surfaceHover: '#ffe4e6',
      border: '#fecdd3',
      text: '#4c0519',
      textMuted: '#be185d',
      success: '#059669',
      warning: '#d97706',
      error: '#dc2626',
      info: '#7c3aed',
    },
  },
};

// =============================================================================
// CONTEXT
// =============================================================================

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultAccent?: AccentColor;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  defaultAccent = 'blue',
  storageKey = 'structural-ui-theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [accentColor, setAccentColorState] = useState<AccentColor>(defaultAccent);
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        queueMicrotask(() => {
          if (parsed.theme) setThemeState(parsed.theme);
          if (parsed.accent) setAccentColorState(parsed.accent);
        });
      }
    } catch (e) {
      console.warn('Failed to load theme preferences:', e);
    }
  }, [storageKey]);

  // Resolve theme (handle 'system')
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateResolvedTheme = () => {
      if (theme === 'system') {
        setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      } else {
        setResolvedTheme(theme);
      }
    };

    updateResolvedTheme();
    mediaQuery.addEventListener('change', updateResolvedTheme);
    
    return () => mediaQuery.removeEventListener('change', updateResolvedTheme);
  }, [theme]);

  // Apply CSS variables
  useEffect(() => {
    const colors = ACCENT_PALETTES[accentColor][resolvedTheme];
    const root = document.documentElement;
    
    // Apply color variables
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // Apply theme class
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    
  }, [resolvedTheme, accentColor]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      const stored = localStorage.getItem(storageKey);
      const current = stored ? JSON.parse(stored) : {};
      localStorage.setItem(storageKey, JSON.stringify({ ...current, theme: newTheme }));
    } catch (e) {
      console.warn('Failed to save theme preference:', e);
    }
  }, [storageKey]);

  const setAccentColor = useCallback((newAccent: AccentColor) => {
    setAccentColorState(newAccent);
    try {
      const stored = localStorage.getItem(storageKey);
      const current = stored ? JSON.parse(stored) : {};
      localStorage.setItem(storageKey, JSON.stringify({ ...current, accent: newAccent }));
    } catch (e) {
      console.warn('Failed to save accent preference:', e);
    }
  }, [storageKey]);

  const value: ThemeContextValue = {
    theme,
    resolvedTheme,
    accentColor,
    setTheme,
    setAccentColor,
    colors: ACCENT_PALETTES[accentColor][resolvedTheme],
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// =============================================================================
// THEME SWITCHER COMPONENT
// =============================================================================

import { Sun, Moon, Monitor, Palette } from 'lucide-react';

interface ThemeSwitcherProps {
  showAccentPicker?: boolean;
  className?: string;
}

export function ThemeSwitcher({ showAccentPicker = true, className }: ThemeSwitcherProps) {
  const { theme, setTheme, accentColor, setAccentColor } = useTheme();
  const [showPalette, setShowPalette] = useState(false);

  const themes: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: 'light', icon: <Sun className="w-4 h-4" />, label: 'Light' },
    { value: 'dark', icon: <Moon className="w-4 h-4" />, label: 'Dark' },
    { value: 'system', icon: <Monitor className="w-4 h-4" />, label: 'System' },
  ];

  const accents: { value: AccentColor; color: string; label: string }[] = [
    { value: 'blue', color: '#3b82f6', label: 'Blue' },
    { value: 'emerald', color: '#10b981', label: 'Emerald' },
    { value: 'purple', color: '#8b5cf6', label: 'Purple' },
    { value: 'amber', color: '#f59e0b', label: 'Amber' },
    { value: 'rose', color: '#f43f5e', label: 'Rose' },
  ];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Theme Selector */}
      <div className="flex items-center bg-slate-200/50 dark:bg-slate-700/50 rounded-lg p-1">
        {themes.map(({ value, icon, label }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={`p-2 rounded-md transition-all ${
              theme === value
                ? 'bg-slate-600 text-slate-900 dark:text-white'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title={label}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Accent Color Picker */}
      {showAccentPicker && (
        <div className="relative">
          <button
            onClick={() => setShowPalette(!showPalette)}
            className="p-2 bg-slate-200/50 dark:bg-slate-700/50 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Accent Color"
          >
            <Palette className="w-4 h-4" />
          </button>
          
          {showPalette && (
            <div className="absolute right-0 top-full mt-2 p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 px-1">Accent Color</p>
              <div className="flex gap-2">
                {accents.map(({ value, color, label }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setAccentColor(value);
                      setShowPalette(false);
                    }}
                    className={`w-8 h-8 rounded-full transition-all ${
                      accentColor === value 
                        ? 'ring-2 ring-slate-300 dark:ring-white ring-offset-2 ring-offset-slate-800' 
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                    title={label}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// DESIGN TOKENS EXPORT
// =============================================================================

export const designTokens = {
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  borderRadius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    glow: '0 0 15px -3px rgba(59, 130, 246, 0.5)',
  },
  transition: {
    fast: '150ms ease',
    normal: '200ms ease',
    slow: '300ms ease',
    spring: '500ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
  animation: {
    fadeIn: 'fadeIn 200ms ease-out',
    slideUp: 'slideUp 300ms ease-out',
    slideDown: 'slideDown 300ms ease-out',
    pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    spin: 'spin 1s linear infinite',
    bounce: 'bounce 1s infinite',
  },
};

export default ThemeProvider;
