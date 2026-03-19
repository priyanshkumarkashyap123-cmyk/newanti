import React, { createContext, FC, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

export type JourneyType = 'newbie' | 'professional' | 'advanced';
export type JourneyProminence = 'primary' | 'secondary' | 'advanced';

export interface JourneyPreferences {
  role?: 'student' | 'professional' | 'enterprise' | null;
  experience?: 'beginner' | 'intermediate' | 'expert' | null;
  primaryUse?: string[];
  designCodes?: string[];
  journey?: JourneyType;
  timestamp?: number;
}

interface JourneyContextValue {
  journey: JourneyType;
  preferences: JourneyPreferences | null;
  showAdvanced: boolean;
  setShowAdvanced: (value: boolean) => void;
  canAccessProminence: (prominence: JourneyProminence) => boolean;
}

const JOURNEY_STORAGE_KEY = 'beamlab_user_preferences';
const ADVANCED_TOGGLE_KEY = 'beamlab_show_advanced_features';

const JourneyContext = createContext<JourneyContextValue | null>(null);

const computeJourney = (prefs: JourneyPreferences | null): JourneyType => {
  if (!prefs) return 'professional';
  if (prefs.journey) return prefs.journey;
  if (prefs.role === 'student' || prefs.experience === 'beginner') return 'newbie';
  if (prefs.role === 'enterprise' || prefs.experience === 'expert') return 'advanced';
  return 'professional';
};

const canAccessForJourney = (
  journey: JourneyType,
  prominence: JourneyProminence,
  showAdvanced: boolean,
): boolean => {
  if (journey === 'advanced') return true;
  if (journey === 'professional') return prominence !== 'advanced' || showAdvanced;
  if (prominence === 'primary') return true;
  return showAdvanced;
};

export const JourneyProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<JourneyPreferences | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ADVANCED_TOGGLE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(JOURNEY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as JourneyPreferences;
      setPreferences(parsed);
    } catch {
      setPreferences(null);
    }
  }, []);

  const journey = useMemo(() => computeJourney(preferences), [preferences]);

  const safeSetShowAdvanced = useCallback((value: boolean) => {
    setShowAdvanced(value);
    try {
      localStorage.setItem(ADVANCED_TOGGLE_KEY, String(value));
    } catch {
      // ignore
    }
  }, []);

  const canAccessProminence = useCallback(
    (prominence: JourneyProminence) => canAccessForJourney(journey, prominence, showAdvanced),
    [journey, showAdvanced],
  );

  const value = useMemo<JourneyContextValue>(
    () => ({
      journey,
      preferences,
      showAdvanced,
      setShowAdvanced: safeSetShowAdvanced,
      canAccessProminence,
    }),
    [journey, preferences, showAdvanced, safeSetShowAdvanced, canAccessProminence],
  );

  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
};

export const useJourneyContext = (): JourneyContextValue => {
  const context = React.useContext(JourneyContext);
  if (!context) {
    throw new Error('useJourneyContext must be used within a JourneyProvider');
  }
  return context;
};
