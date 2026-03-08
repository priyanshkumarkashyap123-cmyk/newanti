/**
 * i18n System - Multi-language Support
 * 
 * BeamLab International Edition
 * Supports: English, Hindi, Spanish, French, German, Chinese, Japanese, Arabic
 * 
 * Features:
 * - Runtime language switching
 * - Nested translation keys
 * - Number/date formatting per locale
 * - Engineering terminology consistency
 * - Right-to-left language support (Arabic)
 * 
 * Usage:
 * ```tsx
 * import { useTranslation } from '@/i18n';
 * 
 * function MyComponent() {
 *   const { t, locale, setLocale } = useTranslation();
 *   return <h1>{t('dashboard.title')}</h1>;
 * }
 * ```
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Supported Languages ──

export type Locale = 'en' | 'hi' | 'es' | 'fr' | 'de' | 'zh' | 'ja' | 'ar';

export interface LanguageInfo {
  code: Locale;
  name: string;
  nativeName: string;
  flag: string;
  rtl: boolean;
}

export const SUPPORTED_LANGUAGES: Record<Locale, LanguageInfo> = {
  en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', rtl: false },
  hi: { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', rtl: false },
  es: { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', rtl: false },
  fr: { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', rtl: false },
  de: { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', rtl: false },
  zh: { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', rtl: false },
  ja: { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', rtl: false },
  ar: { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true },
};

// ── Translation Types ──

export type TranslationKey = string;
export type TranslationValue = string | Record<string, any>;
export type Translations = Record<string, TranslationValue>;

// ── Translation Store ──

interface I18nState {
  locale: Locale;
  translations: Record<Locale, Translations>;
  setLocale: (locale: Locale) => void;
  loadTranslations: (locale: Locale, translations: Translations) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: 'en',
      translations: {} as Record<Locale, Translations>,

      setLocale: (locale: Locale) => {
        set({ locale });
        // Update HTML lang attribute and direction
        document.documentElement.lang = locale;
        document.documentElement.dir = SUPPORTED_LANGUAGES[locale].rtl ? 'rtl' : 'ltr';
      },

      loadTranslations: (locale: Locale, translations: Translations) => {
        set((state) => ({
          translations: {
            ...state.translations,
            [locale]: translations,
          },
        }));
      },

      t: (key: TranslationKey, params?: Record<string, string | number>) => {
        const { locale, translations } = get();
        const localeTranslations = translations[locale] || translations['en'] || {};
        
        // Navigate nested keys (e.g., "dashboard.title.main")
        let value: any = localeTranslations;
        for (const part of key.split('.')) {
          value = value?.[part];
          if (value === undefined) break;
        }

        // Fallback to key if translation not found
        let result = typeof value === 'string' ? value : key;

        // Replace parameters {param}
        if (params) {
          Object.entries(params).forEach(([param, val]) => {
            result = result.replace(new RegExp(`\\{${param}\\}`, 'g'), String(val));
          });
        }

        return result;
      },

      formatNumber: (value: number, options?: Intl.NumberFormatOptions) => {
        const { locale } = get();
        return new Intl.NumberFormat(locale, options).format(value);
      },

      formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
        const { locale } = get();
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return new Intl.DateTimeFormat(locale, options).format(dateObj);
      },
    }),
    {
      name: 'beamlab-i18n',
      partialize: (state) => ({ locale: state.locale }),
    }
  )
);

// ── Custom Hook ──

export function useTranslation() {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const t = useI18nStore((s) => s.t);
  const formatNumber = useI18nStore((s) => s.formatNumber);
  const formatDate = useI18nStore((s) => s.formatDate);

  return {
    locale,
    setLocale,
    t,
    formatNumber,
    formatDate,
    languageInfo: SUPPORTED_LANGUAGES[locale],
    availableLanguages: Object.values(SUPPORTED_LANGUAGES),
  };
}

// ── Lazy Translation Loading ──

const translationCache = new Map<Locale, Translations>();

export async function loadLocale(locale: Locale): Promise<Translations> {
  // Check cache first
  if (translationCache.has(locale)) {
    return translationCache.get(locale)!;
  }

  try {
    // Dynamic import of translation files
    const module = await import(`./locales/${locale}.json`);
    const translations = module.default;
    
    // Cache translations
    translationCache.set(locale, translations);
    
    // Load into store
    useI18nStore.getState().loadTranslations(locale, translations);
    
    return translations;
  } catch (error) {
    console.warn(`Failed to load translations for locale: ${locale}`, error);
    // Fallback to English
    if (locale !== 'en') {
      return loadLocale('en');
    }
    return {};
  }
}

// ── Initialization ──

export async function initI18n(defaultLocale: Locale = 'en') {
  const storedLocale = useI18nStore.getState().locale;
  const locale = storedLocale || defaultLocale;
  
  await loadLocale(locale);
  useI18nStore.getState().setLocale(locale);
}
