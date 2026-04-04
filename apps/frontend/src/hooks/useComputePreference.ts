import { useState, useEffect } from 'react';
import { getComputePreference, ComputePreference } from '../utils/computePreference';

export function useComputePreference() {
  const [preference, setPreference] = useState<ComputePreference>(getComputePreference());

  useEffect(() => {
    // Listen for local storage changes if settings page updates it
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'beamlab.compute.preference') {
        setPreference(getComputePreference());
      }
    };
    
    // Custom event for same-window updates
    const handleLocalUpdate = () => {
      setPreference(getComputePreference());
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('beamlab.compute.preference.changed', handleLocalUpdate as EventListener);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('beamlab.compute.preference.changed', handleLocalUpdate as EventListener);
    };
  }, []);

  return preference;
}
