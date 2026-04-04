/**
 * Branding and color preset configurations for reports\n */

export interface ColorPreset {
    name: string;
    primary: string;
    accent: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
    { name: 'Blue Professional', primary: '#1e40af', accent: '#3b82f6' },
    { name: 'Green Corporate', primary: '#166534', accent: '#22c55e' },
    { name: 'Gray Minimal', primary: '#374151', accent: '#6b7280' },
    { name: 'Red Bold', primary: '#991b1b', accent: '#dc2626' },
    { name: 'Purple Modern', primary: '#5b21b6', accent: '#8b5cf6' },
    { name: 'Teal Fresh', primary: '#115e59', accent: '#14b8a6' },
] as const;

export const DEFAULT_BRANDING = {
    companyName: 'Your Company',
    primaryColor: COLOR_PRESETS[0].primary,
    accentColor: COLOR_PRESETS[0].accent,
    headerStyle: 'modern' as const,
} as const;
